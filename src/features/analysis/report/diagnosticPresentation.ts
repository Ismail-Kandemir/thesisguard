import type {
  AnalysisDiagnostic,
  AnalysisDiagnosticCode,
  AnalysisDiagnosticSeverity,
  ObjectRepresentationKind,
} from "../types";

export interface DiagnosticPresentation {
  id: string;
  title: string;
  description: string;
  severity: AnalysisDiagnosticSeverity;
  severityLabel: string;
  representationLabel: string;
  actionText: string;
  details: DiagnosticPresentationDetail[];
}

export interface DiagnosticPresentationDetail {
  label: string;
  value: string;
}

const diagnosticTitles: Record<AnalysisDiagnosticCode, string> = {
  UNRESOLVED_ACADEMIC_OBJECT: "Akademik rol belirlenemedi",
  UNSUPPORTED_OBJECT_REPRESENTATION: "Nesne otomatik sınıflandırma kapsamı dışında",
  AMBIGUOUS_OBJECT_CAPTION_ASSOCIATION: "Nesne ile başlık ilişkisi belirsiz",
  AMBIGUOUS_ACADEMIC_OBJECT: "Nesnenin akademik türü belirsiz",
};

const severityLabels: Record<AnalysisDiagnosticSeverity, string> = {
  info: "Bilgi",
  warning: "İnceleme gerekli",
};

const representationLabels: Record<ObjectRepresentationKind, string> = {
  picture: "görsel nesne",
  chart: "grafik",
  diagram: "diyagram",
  group: "gruplanmış görsel nesne",
  textbox: "metin kutusu",
  "vml-image": "eski biçimli görsel nesne",
  ole: "gömülü nesne",
  equation: "denklem",
  table: "tablo nesnesi",
  "unknown-drawing": "sınıflandırılamayan çizim nesnesi",
};

export function toDiagnosticPresentation(
  diagnostic: AnalysisDiagnostic,
): DiagnosticPresentation {
  const representationLabel =
    representationLabels[diagnostic.representationKind];

  return {
    id: diagnostic.id,
    title: diagnosticTitles[diagnostic.code],
    description: diagnostic.message,
    severity: diagnostic.severity,
    severityLabel: severityLabels[diagnostic.severity],
    representationLabel,
    actionText: getActionText(diagnostic, representationLabel),
    details: getDiagnosticDetails(diagnostic, representationLabel),
  };
}

export function hasReviewRequiredDiagnostics(
  diagnostics: readonly AnalysisDiagnostic[],
): boolean {
  return diagnostics.length > 0;
}

export function formatReviewRequiredCount(count: number): string {
  return `${count} unsur`;
}

export function getScoreTrustMessage(
  diagnostics: readonly AnalysisDiagnostic[],
): string {
  if (diagnostics.length === 0) {
    return "Uyumluluk puanı, otomatik olarak değerlendirilebilen kontrollerin sonucudur. Tezin akademik içerik kalitesini veya tüm kılavuz gerekliliklerini garanti etmez.";
  }

  return [
    "Uyumluluk puanı değerlendirilebilen kurallara göre hesaplanmıştır.",
    `Belgede ayrıca manuel inceleme gerektiren ${formatReviewRequiredCount(diagnostics.length)} bulundu.`,
  ].join(" ");
}

function getActionText(
  diagnostic: AnalysisDiagnostic,
  representationLabel: string,
): string {
  if (diagnostic.code === "UNRESOLVED_ACADEMIC_OBJECT") {
    return `Bu ${representationLabel} öğesinin akademik şekil/tablo kurallarına dahil edilip edilmemesi gerektiğini kontrol edin.`;
  }

  if (diagnostic.code === "UNSUPPORTED_OBJECT_REPRESENTATION") {
    return `Bu ${representationLabel} öğesini manuel inceleyin; otomatik sınıflandırma bu nesne türü için sınırlıdır.`;
  }

  if (diagnostic.code === "AMBIGUOUS_OBJECT_CAPTION_ASSOCIATION") {
    return "Yakındaki başlığın hangi nesneye ait olduğunu ve belgedeki yerleşimi manuel kontrol edin.";
  }

  return "Nesnenin akademik türünü ve yakınındaki başlık beyanını birlikte kontrol edin.";
}

function getDiagnosticDetails(
  diagnostic: AnalysisDiagnostic,
  representationLabel: string,
): DiagnosticPresentationDetail[] {
  const details: DiagnosticPresentationDetail[] = [
    { label: "Nesne türü", value: representationLabel },
    {
      label: "Belge kapsamı",
      value: getAcademicScopeLabel(diagnostic.evidence.academicScope),
    },
    {
      label: "Analiz durumu",
      value: getResolutionLabel(diagnostic.resolutionStatus),
    },
  ];
  const location = getLocationLabel(diagnostic);
  const captionText = diagnostic.evidence.candidateCaptions[0]?.textExcerpt;

  if (location) {
    details.push({ label: "Yaklaşık konum", value: location });
  }

  if (captionText) {
    details.push({ label: "Yakındaki başlık", value: captionText });
  }

  return details;
}

function getAcademicScopeLabel(
  academicScope: AnalysisDiagnostic["evidence"]["academicScope"],
): string {
  if (academicScope === "front-matter") {
    return "Ön bölüm";
  }

  if (academicScope === "main-content") {
    return "Akademik ana içerik";
  }

  return "Belirlenemedi";
}

function getResolutionLabel(
  resolutionStatus: AnalysisDiagnostic["resolutionStatus"],
): string {
  if (resolutionStatus === "ambiguous") {
    return "Belirsiz";
  }

  if (resolutionStatus === "unresolved") {
    return "Çözümlenemedi";
  }

  if (resolutionStatus === "excluded") {
    return "Kapsam dışında";
  }

  return "Beyan edilmiş";
}

function getLocationLabel(diagnostic: AnalysisDiagnostic): string | null {
  const paragraphIndex = diagnostic.evidence.paragraphIndex;
  const blockIndex = diagnostic.evidence.blockIndex;

  if (paragraphIndex !== null) {
    return `Belgedeki paragraf: ${paragraphIndex + 1}`;
  }

  if (blockIndex !== null) {
    return `Belge akışındaki blok: ${blockIndex + 1}`;
  }

  return null;
}
