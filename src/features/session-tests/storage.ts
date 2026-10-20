/** Private Storage bucket of test photos (policies in 20261020090000_session_tests_answer_keys.sql). */
export const SESSION_TEST_BUCKET = "session-tests";

/** Path of a new page photo: {test_id}/{uuid}.jpg, the only shape the upload policy accepts. */
export function newTestPagePath(testId: string, randomId: string = crypto.randomUUID()): string {
  return `${testId}/${randomId.toLowerCase()}.jpg`;
}
