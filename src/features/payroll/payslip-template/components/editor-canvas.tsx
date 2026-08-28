"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Sparkles } from "lucide-react";

import { PayslipDocument } from "@/features/payroll/payslip/components/payslip-document";
import { PAYSLIP_SAMPLE_DATA } from "@/features/payroll/payslip-template/sample-data";
import type {
  PayslipSectionConfig,
  PayslipTemplateConfiguration,
} from "@/features/payroll/payslip-template/types";

interface SortableSectionItemProps {
  children: React.ReactNode;
  id: string;
  isSelected: boolean;
  onSelect: () => void;
  title: string;
}

function SortableSectionItem({
  children,
  id,
  isSelected,
  onSelect,
  title,
}: SortableSectionItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    opacity: isDragging ? 0.4 : 1,
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      className={`group relative rounded-xl transition-all ${
        isSelected
          ? "ring-2 ring-primary ring-offset-2 shadow-sm"
          : "hover:ring-1 hover:ring-hairline-strong"
      }`}
      onClick={onSelect}
      ref={setNodeRef}
      style={style}
    >
      {/* Drag handle overlay */}
      <div
        aria-label={`Kéo để đổi vị trí ${title}`}
        className="absolute -left-3 top-2 z-30 flex size-6 items-center justify-center rounded-md bg-white border border-slate-200 text-slate-400 opacity-0 shadow-xs transition-opacity group-hover:opacity-100 cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3.5" />
      </div>

      {children}
    </div>
  );
}

interface EditorCanvasProps {
  configuration: PayslipTemplateConfiguration;
  onReorderSections: (newSections: PayslipSectionConfig[]) => void;
  onSelectBlock: (id: string) => void;
  selectedBlockId: string | null;
  zoom: number;
}

export function EditorCanvas({
  configuration,
  onReorderSections,
  onSelectBlock,
  selectedBlockId,
  zoom,
}: EditorCanvasProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = configuration.sections.findIndex((s) => s.id === active.id);
      const newIndex = configuration.sections.findIndex((s) => s.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(configuration.sections, oldIndex, newIndex);
        onReorderSections(reordered);
      }
    }
  };

  return (
    <div className="flex-1 overflow-x-auto rounded-2xl border border-hairline bg-slate-100/70 p-4 sm:p-8 flex justify-center items-start min-h-[750px]">
      <div
        className="w-full max-w-[210mm] transition-transform origin-top"
        style={{
          transform: `scale(${zoom / 100})`,
        }}
      >
        {/* Helper Tip */}
        <div className="mb-4 flex items-center justify-between rounded-xl bg-white/80 px-3.5 py-2 text-xs text-slate-600 shadow-xs backdrop-blur-xs border border-slate-200/60">
          <span className="flex items-center gap-1.5 font-medium">
            <Sparkles className="size-3.5 text-primary" />
            Bản xem trước A4 trực quan với dữ liệu mẫu an toàn. Nhấp vào từng khối để chỉnh sửa.
          </span>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Khổ chuẩn: 210mm × 297mm
          </span>
        </div>

        {/* Live Document Renderer with Template Configuration */}
        <DndContext
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          sensors={sensors}
        >
          <SortableContext
            items={configuration.sections.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <PayslipDocument
              data={PAYSLIP_SAMPLE_DATA}
              isEditorMode={true}
              onSelectBlock={onSelectBlock}
              selectedBlockId={selectedBlockId}
              templateConfig={configuration}
            />
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
