// Form nộp bài cuối buổi "Nộp bài tốt nghiệp - Thầy Vinh" (Trung tâm Toán Thầy Vinh).
// Gắn với Sheet "[Test mới] Phiếu điểm danh buổi học lớp Chuyên sâu, Coaching (Câu trả lời)".
//
// Bản cho ERP, Giai đoạn 1 "Nhận bài vào ERP":
// - Vẫn ghi tab "Data" như bản cũ (cột A–P giữ nguyên ý nghĩa).
// - Danh sách học sinh lấy từ ERP theo năm sinh (lưu đệm 10 phút); ERP không trả lời thì
//   dùng tab "DanhSachHocSinh" như cũ.
// - Ghi Sheet xong thì gửi một bản sang ERP (có chữ ký HMAC). Gửi lỗi không làm hỏng lượt
//   nộp của học sinh: trigger 10 phút/lần gửi lại các dòng chưa gửi được.
// - Lựa chọn "Khác" ghi "Khác: <chữ học sinh gõ>" (bản cũ chỉ ghi "Other").
// - Câu 6 (học thử tiếng Anh) và câu 7 (SĐT phụ huynh) chỉ ghi vào Sheet, không gửi ERP.
//
// Cài đặt: xem README.md cùng thư mục (Script Properties ERP_BASE_URL, ERP_FORM_SECRET; chạy
// installResendTrigger một lần; chạy testErpConnection để kiểm tra).

const DATA_SHEET = 'Data';
const FALLBACK_ROSTER_SHEET = 'DanhSachHocSinh';
const TIME_ZONE = 'Asia/Ho_Chi_Minh';
const ERP_COLUMNS = {
  studentCode: 'Mã HS ERP',
  sessionId: 'Buổi học ERP',
  externalId: 'Mã bài ERP',
  submittedAt: 'Giờ nộp ERP',
  sentStatus: 'Đã gửi ERP',
};
const ROSTER_CACHE_SECONDS = 600;
const RESEND_BATCH = 40;
// ERP cắt bài làm ở 20.000 ký tự và đánh dấu; gửi tối đa 60.000 để body không quá giới hạn.
const MAX_ANSWER_CHARS_SENT = 60000;
const RESEND_LOOKBACK_ROWS = 3000;
const DEFAULT_BIRTH_YEARS = [2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012, 2011, 2010, 2009, 2008];
// Lỗi do dữ liệu (không gửi lại); các lỗi khác (mạng, 401, 5xx) được gửi lại.
const TERMINAL_STATUSES = [400, 413, 415, 422];

function doGet() {
  return HtmlService.createTemplateFromFile('FormHocSinh')
      .evaluate()
      .setTitle('Nộp bài tốt nghiệp - Thầy Vinh')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ---------------------------------------------------------------------------
// Danh sách học sinh cho form (gọi qua google.script.run)
// ---------------------------------------------------------------------------

function getBirthYears() {
  const cache = CacheService.getScriptCache();
  const key = 'erp-birth-years-' + todayKey_();
  const hit = cache.get(key);
  if (hit) return JSON.parse(hit);

  const res = erpFetch_('GET', '/api/integrations/grading-roster');
  if (res.ok && res.json && Array.isArray(res.json.birthYears) && res.json.birthYears.length > 0) {
    cache.put(key, JSON.stringify(res.json.birthYears), ROSTER_CACHE_SECONDS);
    return res.json.birthYears;
  }
  return DEFAULT_BIRTH_YEARS;
}

// Trả { source: 'erp' | 'sheet', students: [{ code, label, fullName, givenName, sessions: [{ id, label }] }] }.
function getStudentsByBirthYear(birthYear) {
  const year = String(birthYear || '').replace(/\D/g, '');
  if (!/^\d{4}$/.test(year)) return { source: 'none', students: [] };

  const cache = CacheService.getScriptCache();
  const key = 'erp-roster-' + year + '-' + todayKey_();
  const hit = cache.get(key);
  if (hit) return JSON.parse(hit);

  const res = erpFetch_('GET', '/api/integrations/grading-roster?birthYear=' + year);
  if (res.ok && res.json && Array.isArray(res.json.students)) {
    const result = {
      source: 'erp',
      students: res.json.students.map(function (s) {
        return {
          code: s.code,
          label: s.label,
          fullName: s.fullName,
          givenName: s.givenName,
          sessions: (s.sessions || []).map(function (x) { return { id: x.id, label: x.label }; }),
        };
      }),
    };
    const text = JSON.stringify(result);
    if (text.length < 90000) cache.put(key, text, ROSTER_CACHE_SECONDS);
    return result;
  }

  return { source: 'sheet', students: fallbackStudents_(year) };
}

// Tab DanhSachHocSinh: cột A năm sinh, B họ tên, C tên. Không có mã ERP, không có buổi học.
function fallbackStudents_(year) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FALLBACK_ROSTER_SHEET);
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  rows.shift();
  return rows
    .filter(function (r) { return String(r[0]) === year && String(r[1] || '').trim() !== ''; })
    .map(function (r) {
      const fullName = String(r[1]).trim();
      return { code: '', label: fullName, fullName: fullName, givenName: String(r[2] || lastWord_(fullName)).trim(), sessions: [] };
    })
    .sort(function (a, b) {
      return lastWord_(a.fullName).localeCompare(lastWord_(b.fullName), 'vi') || a.fullName.localeCompare(b.fullName, 'vi');
    });
}

// ---------------------------------------------------------------------------
// Nộp bài
// ---------------------------------------------------------------------------

function processForm(formObject) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(DATA_SHEET);
    if (!sheet) return "Error: Không tìm thấy sheet 'Data'";

    // 1. Chuẩn bị thông tin học sinh
    const pickedManual = formObject.hoTen === 'CHUA_CO_TEN';
    const studentCode = pickedManual ? '' : cleanStudentCode_(formObject.maHocSinh);
    const finalHoTen = (pickedManual ? formObject.hoTenManual : formObject.hoTenDayDu || formObject.hoTen || '').trim();
    const namSinh = formObject.namSinh || '20xx';

    // Buổi học: buổi từ lịch ERP, hoặc lựa chọn cũ (A/B/CLC/Con không rõ/Khác).
    const sessionId = cleanUuid_(formObject.buoiHocErp);
    const khac = String(formObject.buoiHocKhac || '').trim();
    let classOption = sessionId ? '' : String(formObject.buoiHoc || '').trim();
    if (classOption === 'Other') classOption = 'Khác';
    // Câu 6 (học thử tiếng Anh) chỉ ghi Sheet; "Khác" ghi kèm chữ học sinh gõ như câu 5.
    const hocThuAnh = String(formObject.hocThuAnh || '').trim();
    const hocThuAnhKhac = String(formObject.hocThuAnhKhac || '').trim();
    const hocThuAnhText = hocThuAnh === 'Other' ? (hocThuAnhKhac ? 'Khác: ' + hocThuAnhKhac : 'Khác') : hocThuAnh;
    const buoiHocText = sessionId
      ? String(formObject.buoiHocErpLabel || 'Buổi học ERP')
      : classOption === 'Khác' ? 'Khác: ' + khac : classOption;

    // Mốc thời gian nộp chuẩn
    const now = new Date();
    const timeStamp = Utilities.formatDate(now, 'GMT+7', 'dd/MM/yyyy HH:mm:ss');
    const submittedAt = Utilities.formatDate(now, TIME_ZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
    const externalId = Utilities.getUuid();

    // 2. Ảnh (form hiện không gửi ảnh, giữ như bản cũ)
    const allUrls = saveImages_(formObject, finalHoTen, namSinh);

    // 3. Ghi Sheet (khóa để cột ERP không bị tạo hai lần khi nhiều em nộp cùng lúc)
    const answer = String(formObject.linkBaiThi || '');
    const rowData = [
      sheetText_(finalHoTen),           // A
      sheetText_(formObject.tenHocSinh || ''), // B
      "'" + answer,                     // C (giữ nguyên chữ: "15/4", "007", "=2+3" không bị Sheets đổi)
      '', '',                           // D, E (Điểm thi, Điểm vở: trợ giảng điền)
      timeStamp,                        // F
      '', '',                           // G, H
      namSinh,                          // I
      sheetText_(buoiHocText),          // J
      formObject.troGiang || '',        // K
      formObject.rating || '',          // L
      formObject.caiTien || '',         // M
      sheetText_(hocThuAnhText),        // N
      "'" + (formObject.sdtBoMe || ''), // O
      allUrls.join('\n'),               // P
    ];

    const lock = LockService.getDocumentLock();
    lock.waitLock(20000);
    let cols = null;
    try {
      try {
        cols = ensureErpColumns_(sheet);
      } catch (colErr) {
        // Không thêm được cột ERP: vẫn ghi bài vào Sheet như bản cũ, chỉ không gửi ERP.
        console.log('Không thêm được cột ERP: ' + colErr);
      }
      if (cols) {
        setCell_(rowData, cols.studentCode, studentCode);
        setCell_(rowData, cols.sessionId, sessionId);
        setCell_(rowData, cols.externalId, externalId);
        setCell_(rowData, cols.submittedAt, "'" + submittedAt);
        setCell_(rowData, cols.sentStatus, '');
      }
      sheet.appendRow(rowData);
    } finally {
      lock.releaseLock();
    }
    if (!cols) return 'OK';

    // 4. Gửi sang ERP. Lỗi ở đây không báo cho học sinh: trigger sẽ gửi lại.
    try {
      const result = postSubmission_({
        version: 1,
        externalId: externalId,
        submittedAt: submittedAt,
        answerText: limitChars_(answer, MAX_ANSWER_CHARS_SENT),
        studentCode: studentCode || null,
        fullName: finalHoTen,
        birthYear: Number(namSinh),
        classSessionId: sessionId || null,
        classOption: classOption || null,
        classOptionOther: classOption === 'Khác' ? khac || null : null,
      });
      writeSentStatus_(sheet, cols, externalId, result);
    } catch (sendErr) {
      console.log('Gửi ERP lỗi, trigger sẽ gửi lại: ' + sendErr);
    }

    return 'OK';
  } catch (e) {
    return 'Lỗi phần mềm nội bộ (Báo thầy Vinh hỗ trợ): ' + e.toString();
  }
}

function saveImages_(formObject, finalHoTen, namSinh) {
  const allUrls = [];
  if (!formObject.files || formObject.files.length === 0) return allUrls;
  try {
    const folderId = '1c4kTNij1mUIRsB5DOB5cN0JXRTvKOiYt';
    const folder = DriveApp.getFolderById(folderId);
    for (let i = 0; i < formObject.files.length; i++) {
      const fileObj = formObject.files[i];
      const contentType = fileObj.data.substring(5, fileObj.data.indexOf(';'));
      const bytes = Utilities.base64Decode(fileObj.data.split(',')[1]);
      const blob = Utilities.newBlob(bytes, contentType, fileObj.name);
      const file = folder.createFile(blob);
      const suffix = formObject.files.length > 1 ? ' - Ảnh ' + (i + 1) : '';
      const dtName = Utilities.formatDate(new Date(), 'GMT+7', 'dd.MM.yyyy HH.mm.ss');
      file.setName(finalHoTen + ' - ' + namSinh + ' - ' + dtName + suffix + '.jpg');
      try {
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (sharingErr) {
        console.log('Không thể setSharing vì quyền admin, bỏ qua an toàn: ' + sharingErr);
      }
      allUrls.push(file.getUrl());
      Utilities.sleep(400);
    }
  } catch (imgErr) {
    allUrls.push('Lỗi hệ thống khi lưu ảnh: ' + imgErr.toString());
  }
  return allUrls;
}

// ---------------------------------------------------------------------------
// Gửi bù (trigger 10 phút/lần)
// ---------------------------------------------------------------------------

// Gửi lại các dòng có "Mã bài ERP" mà "Đã gửi ERP" chưa phải "OK…" hay "Bị từ chối…".
// Dòng cũ (trước khi dùng bản này) không có mã bài nên không bao giờ bị gửi.
function resendPendingSubmissions() {
  // Ai mở form cũng gọi được hàm công khai qua google.script.run: chặn chạy dồn dập.
  if (!runAtMostEvery_('resend', 240)) return;
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    if (!getConfig_().enabled) return;
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_SHEET);
    if (!sheet) return;
    const cols = findErpColumns_(sheet);
    if (!cols) return;
    const last = sheet.getLastRow();
    if (last < 2) return;
    const first = Math.max(2, last - RESEND_LOOKBACK_ROWS + 1);
    const width = sheet.getLastColumn();
    const values = sheet.getRange(first, 1, last - first + 1, width).getDisplayValues();

    // Mới nhất trước: dòng lỗi mãi ở phía trên không chặn được bài mới.
    let sent = 0;
    for (let i = values.length - 1; i >= 0 && sent < RESEND_BATCH; i--) {
      const row = values[i];
      const externalId = row[cols.externalId - 1];
      const status = row[cols.sentStatus - 1];
      if (!externalId || /^OK/.test(status) || /^Bị từ chối/.test(status)) continue;
      const result = postSubmission_(payloadFromRow_(row, cols));
      writeSentStatus_(sheet, cols, externalId, result);
      sent++;
    }
  } finally {
    lock.releaseLock();
  }
}

function payloadFromRow_(row, cols) {
  const sessionId = cleanUuid_(row[cols.sessionId - 1]);
  const j = String(row[9] || '').trim();
  let classOption = sessionId ? '' : j;
  let classOptionOther = '';
  if (!sessionId && /^Khác:/.test(j)) {
    classOption = 'Khác';
    classOptionOther = j.replace(/^Khác:\s*/, '');
  } else if (!sessionId && j === 'Other') {
    classOption = 'Khác';
  }
  return {
    version: 1,
    externalId: row[cols.externalId - 1],
    submittedAt: String(row[cols.submittedAt - 1]).replace(/^'/, ''),
    answerText: limitChars_(String(row[2] || ''), MAX_ANSWER_CHARS_SENT),
    studentCode: cleanStudentCode_(row[cols.studentCode - 1]) || null,
    fullName: String(row[0] || '').trim(),
    birthYear: Number(row[8]),
    classSessionId: sessionId || null,
    classOption: classOption || null,
    classOptionOther: classOptionOther || null,
  };
}

function installResendTrigger() {
  if (!runAtMostEvery_('install-trigger', 60)) return;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'resendPendingSubmissions') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('resendPendingSubmissions').timeBased().everyMinutes(10).create();
}

// ---------------------------------------------------------------------------
// Kiểm tra kết nối (chạy tay trong trình soạn Apps Script, xem Nhật ký thực thi)
// ---------------------------------------------------------------------------

function testErpConnection() {
  if (!runAtMostEvery_('test-connection', 30)) {
    console.log('Vừa chạy xong, đợi 30 giây rồi chạy lại.');
    return;
  }
  const cfg = getConfig_();
  if (!cfg.enabled) {
    console.log('Chưa cấu hình: đặt ERP_BASE_URL và ERP_FORM_SECRET (ít nhất 32 ký tự) trong Script Properties.');
    return;
  }
  console.log('Địa chỉ ERP: ' + cfg.baseUrl);
  const years = erpFetch_('GET', '/api/integrations/grading-roster');
  console.log('Danh sách năm sinh: HTTP ' + years.status + (years.ok ? ' → ' + JSON.stringify(years.json.birthYears) : ' (lỗi)' + fetchErrorNote_(years)));
  // Body thiếu trường bắt buộc: 400 nghĩa là chữ ký (kể cả chữ có dấu) đúng; 401 là sai khóa hoặc lệch giờ.
  const probe = erpFetch_('POST', '/api/webhooks/grading-submissions', JSON.stringify({ probe: 'Kiểm tra chữ ký' }));
  console.log('Webhook: HTTP ' + probe.status + (probe.status === 400 ? ' → chữ ký đúng' : probe.status === 401 ? ' → SAI khóa hoặc lệch giờ' : fetchErrorNote_(probe)));
}

// HTTP 0 nghĩa là Apps Script không gọi được ERP; in kèm lý do để biết sửa chỗ nào.
function fetchErrorNote_(res) {
  if (res.status !== 0 || !res.error) return '';
  if (/permission|external_request/i.test(res.error)) {
    return ' → dự án chưa có quyền gọi ra ngoài: trong appsscript.json thêm "https://www.googleapis.com/auth/script.external_request" vào oauthScopes, rồi chạy lại và bấm Cho phép. Chi tiết: ' + res.error;
  }
  return ' → ' + res.error;
}

// ---------------------------------------------------------------------------
// Tiện ích
// ---------------------------------------------------------------------------

function getConfig_() {
  const props = PropertiesService.getScriptProperties();
  const baseUrl = String(props.getProperty('ERP_BASE_URL') || '').trim().replace(/\/+$/, '');
  const secret = String(props.getProperty('ERP_FORM_SECRET') || '').trim();
  return { baseUrl: baseUrl, secret: secret, enabled: /^https:\/\//.test(baseUrl) && secret.length >= 32 };
}

function sign_(secret, timestamp, message) {
  const bytes = Utilities.computeHmacSha256Signature(timestamp + '.' + message, secret, Utilities.Charset.UTF_8);
  return 'sha256=' + bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

// GET ký "GET <đường dẫn>?<query>", POST ký nguyên body (UTF-8).
function erpFetch_(method, pathAndQuery, body) {
  const cfg = getConfig_();
  if (!cfg.enabled) return { ok: false, status: 0, error: 'ERP chưa cấu hình' };
  const timestamp = String(Math.floor(Date.now() / 1000));
  const message = method === 'GET' ? 'GET ' + pathAndQuery : body;
  const options = {
    method: method.toLowerCase(),
    muteHttpExceptions: true,
    followRedirects: false,
    headers: { 'x-ttv-timestamp': timestamp, 'x-ttv-signature': sign_(cfg.secret, timestamp, message) },
  };
  if (method === 'POST') {
    options.contentType = 'application/json; charset=utf-8';
    options.payload = body;
  }
  try {
    const res = UrlFetchApp.fetch(cfg.baseUrl + pathAndQuery, options);
    const status = res.getResponseCode();
    let json = null;
    // ERP trả JSON không ghi charset: đọc rõ UTF-8 để tên tiếng Việt không bị vỡ chữ.
    try { json = JSON.parse(res.getContentText('UTF-8')); } catch (parseErr) { json = null; }
    return { ok: status >= 200 && status < 300, status: status, json: json };
  } catch (e) {
    return { ok: false, status: 0, error: String(e) };
  }
}

function postSubmission_(payload) {
  return erpFetch_('POST', '/api/webhooks/grading-submissions', JSON.stringify(payload));
}

function writeSentStatus_(sheet, cols, externalId, result) {
  const at = Utilities.formatDate(new Date(), TIME_ZONE, 'dd/MM HH:mm');
  let text;
  if (result.ok) text = 'OK ' + at + (result.json && result.json.duplicate ? ' (đã có)' : '');
  else if (TERMINAL_STATUSES.indexOf(result.status) >= 0) text = 'Bị từ chối ' + result.status + ' ' + at;
  else text = 'Lỗi ' + (result.status || (result.error || 'mạng')) + ' ' + at;

  const last = sheet.getLastRow();
  const cell = sheet.getRange(1, cols.externalId, last, 1).createTextFinder(externalId).matchEntireCell(true).findNext();
  if (cell) sheet.getRange(cell.getRow(), cols.sentStatus).setValue(text);
}

function findErpColumns_(sheet) {
  const width = sheet.getLastColumn();
  if (width < 1) return null;
  const headers = sheet.getRange(1, 1, 1, width).getDisplayValues()[0].map(function (h) { return String(h).trim(); });
  const cols = {};
  for (const key in ERP_COLUMNS) {
    const index = headers.indexOf(ERP_COLUMNS[key]);
    if (index < 0) return null;
    cols[key] = index + 1;
  }
  return cols;
}

// Tìm cột ERP theo tiêu đề dòng 1; thiếu thì thêm vào sau cột cuối cùng (không đụng cột A–P).
function ensureErpColumns_(sheet) {
  const width = Math.max(sheet.getLastColumn(), 16);
  const headers = sheet.getRange(1, 1, 1, width).getDisplayValues()[0].map(function (h) { return String(h).trim(); });
  let next = Math.max(sheet.getLastColumn(), 16) + 1;
  const cols = {};
  for (const key in ERP_COLUMNS) {
    const index = headers.indexOf(ERP_COLUMNS[key]);
    if (index >= 0) {
      cols[key] = index + 1;
    } else {
      if (next > sheet.getMaxColumns()) sheet.insertColumnsAfter(sheet.getMaxColumns(), next - sheet.getMaxColumns());
      sheet.getRange(1, next).setValue(ERP_COLUMNS[key]);
      cols[key] = next;
      next++;
    }
  }
  return cols;
}

function setCell_(rowData, column, value) {
  while (rowData.length < column) rowData.push('');
  rowData[column - 1] = value;
}

function cleanStudentCode_(value) {
  const code = String(value || '').trim().toUpperCase();
  return /^TV-\d{4}-\d{5,30}$/.test(code) ? code : '';
}

// Chữ do học sinh gõ bắt đầu bằng = + - @ thì Sheets coi là công thức: thêm ' để giữ là chữ.
function sheetText_(value) {
  const text = String(value || '');
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function limitChars_(text, max) {
  const chars = Array.from(String(text || ''));
  return chars.length > max ? chars.slice(0, max).join('') : String(text || '');
}

// true nếu chưa chạy trong `seconds` giây qua (đánh dấu luôn lần chạy này).
function runAtMostEvery_(name, seconds) {
  const cache = CacheService.getScriptCache();
  const key = 'run-' + name;
  if (cache.get(key)) return false;
  cache.put(key, '1', seconds);
  return true;
}

function cleanUuid_(value) {
  const id = String(value || '').trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id) ? id : '';
}

function lastWord_(fullName) {
  const words = String(fullName || '').trim().split(/\s+/);
  return words[words.length - 1] || '';
}

function todayKey_() {
  return Utilities.formatDate(new Date(), TIME_ZONE, 'yyyyMMdd');
}
