/** Shared report reason chips for posts and profiles. */

export type ReportReason = {
  code: string;
  label: string;
  /** Require free-text details when selected */
  requireDetails?: boolean;
};

export const CONTENT_REPORT_REASONS: ReportReason[] = [
  { code: "spam", label: "Спам / реклама" },
  { code: "abuse", label: "Оскорбления" },
  { code: "nsfw", label: "Неприемлемый контент" },
  { code: "scam", label: "Мошенничество" },
  { code: "illegal", label: "Запрещённый материал" },
  { code: "other", label: "Своя тема", requireDetails: true },
];

export const PROFILE_REPORT_REASONS: ReportReason[] = [
  { code: "fake", label: "Фейковый профиль" },
  { code: "spam", label: "Спам / реклама" },
  { code: "abuse", label: "Оскорбления / токсичность" },
  { code: "harassment", label: "Домогательства" },
  { code: "scam", label: "Мошенничество" },
  { code: "underage", label: "Подозрение на несовершеннолетнего" },
  { code: "photos", label: "Чужие / недопустимые фото" },
  { code: "other", label: "Своя тема", requireDetails: true },
];

export function formatReportReason(
  reason: ReportReason,
  details: string
): string {
  const d = details.trim();
  if (!d) return reason.label;
  return `${reason.label}: ${d}`.slice(0, 500);
}
