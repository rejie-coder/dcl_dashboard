import { motion } from 'framer-motion';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { generateTemplateCsvBlob, generateTemplateWorkbook } from '@/lib/export-template';
import * as XLSX from 'xlsx';

/**
 * Template export card (data.md section 2, left 7 columns).
 * Generates a blank .xlsx workbook client-side with SheetJS and a CSV
 * mirror, then triggers a download. Nothing is uploaded anywhere.
 */
export function TemplateDownloadCard() {
  const downloadXlsx = () => {
    // SheetJS writeFile triggers the browser download directly (§11.9)
    XLSX.writeFile(generateTemplateWorkbook(), 'dcl-performance-template.xlsx');
  };

  const downloadCsv = () => {
    const blob = generateTemplateCsvBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dcl-performance-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.28 }}
      className="dcl-card flex flex-col rounded-[24px] p-6 lg:col-span-7"
    >
      <h2 className="font-display text-[18px] font-semibold tracking-[-0.01em] text-[var(--dcl-ink-900)]">
        Start with the official template
      </h2>
      <p className="mt-1.5 max-w-lg text-[13.5px] leading-[1.55] text-[var(--dcl-ink-500)]">
        One wide Observations sheet — one row per unit per week or month, plain counts and LKR amounts. The
        dashboard calculates every KPI for you. Includes a README, dropdown lists, and marked example rows.
      </p>

      <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
        <motion.button
          type="button"
          id="template-download-btn"
          whileTap={{ scale: 0.98 }}
          onClick={downloadXlsx}
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[#007AFF] px-5 text-[13.5px] font-semibold text-white shadow-sm transition-colors hover:bg-[#0066D6]"
        >
          <FileSpreadsheet className="h-4 w-4" />
          Download Excel template
        </motion.button>
        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          onClick={downloadCsv}
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full border border-[var(--dcl-line)] bg-white px-5 text-[13.5px] font-semibold text-[var(--dcl-ink-700)] shadow-sm transition-colors hover:bg-[var(--dcl-surface-tint)]"
        >
          <FileText className="h-4 w-4 text-[#007AFF]" />
          Download CSV template
        </motion.button>
      </div>

      <p className="font-num mt-4 text-[12px] text-[var(--dcl-ink-400)]">
        3 sheets · 62 columns · 6 units · Week/Month grains · LKR
      </p>
    </motion.div>
  );
}
