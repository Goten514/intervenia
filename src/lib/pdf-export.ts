import jsPDF from 'jspdf';

export interface InterventionPDFData {
  titre?: string;
  duree?: string;
  problematique?: string;
  type?: string;
  age?: number | string;
  materiel?: string[];
  objectifs?: string[];
  etapes?: { numero: number; titre: string; description: string }[];
  conseils_intervenant?: string[];
  adaptations?: string[];
  indicateurs_succes?: string[];
}

interface ExportOptions {
  clientName?: string;
}

/**
 * Generate a styled PDF for an intervention and trigger a browser download.
 *
 * Layout:
 *  - Indigo/violet gradient-like header band with IntervenIA branding
 *  - Title + meta chips (duration, age, problematique, type)
 *  - Sections: Objectifs, Matériel, Étapes (numbered), Conseils, Indicateurs
 *  - Footer on every page: generation date + client name + page number
 */
export function exportInterventionToPDF(
  intervention: InterventionPDFData,
  options: ExportOptions = {}
): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });

  // A4 in points: 595.28 x 841.89
  const PAGE_W = doc.internal.pageSize.getWidth();
  const PAGE_H = doc.internal.pageSize.getHeight();
  const MARGIN = 48;
  const CONTENT_W = PAGE_W - MARGIN * 2;

  // Colors
  const INDIGO: [number, number, number] = [79, 70, 229];      // indigo-600
  const VIOLET: [number, number, number] = [124, 58, 237];     // violet-600
  const SLATE_900: [number, number, number] = [15, 23, 42];
  const SLATE_700: [number, number, number] = [51, 65, 85];
  const SLATE_500: [number, number, number] = [100, 116, 139];
  const SLATE_200: [number, number, number] = [226, 232, 240];
  const SLATE_50: [number, number, number] = [248, 250, 252];
  const AMBER_BG: [number, number, number] = [254, 243, 199];
  const AMBER_BORDER: [number, number, number] = [251, 191, 36];
  const AMBER_TEXT: [number, number, number] = [120, 53, 15];
  const EMERALD: [number, number, number] = [16, 185, 129];

  let y = 0;
  const generationDate = new Date().toLocaleDateString('fr-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const clientName = options.clientName?.trim() || '';

  // ---- HEADER BAND ----
  const drawHeader = () => {
    // Background band
    doc.setFillColor(...INDIGO);
    doc.rect(0, 0, PAGE_W, 80, 'F');
    // Accent stripe (simulate gradient)
    doc.setFillColor(...VIOLET);
    doc.rect(PAGE_W * 0.55, 0, PAGE_W * 0.45, 80, 'F');

    // Logo: small white square with "IA"
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(MARGIN, 22, 36, 36, 6, 6, 'F');
    doc.setTextColor(...INDIGO);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('IA', MARGIN + 18, 45, { align: 'center', baseline: 'middle' });

    // Brand text
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('IntervenIA', MARGIN + 50, 38);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(224, 231, 255); // indigo-100
    doc.text('Outils d\'intervention generes par IA', MARGIN + 50, 54);

    // Date right-aligned
    doc.setFontSize(9);
    doc.setTextColor(224, 231, 255);
    doc.text(generationDate, PAGE_W - MARGIN, 38, { align: 'right' });
    if (clientName) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.text('Client : ' + clientName, PAGE_W - MARGIN, 54, { align: 'right' });
    }
  };

  // ---- FOOTER ----
  const drawFooter = (pageNum: number, totalPages: number) => {
    doc.setDrawColor(...SLATE_200);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, PAGE_H - 40, PAGE_W - MARGIN, PAGE_H - 40);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...SLATE_500);
    const footerLeft = clientName
      ? `Genere le ${generationDate}  |  Client : ${clientName}`
      : `Genere le ${generationDate}`;
    doc.text(footerLeft, MARGIN, PAGE_H - 24);
    doc.text(
      `IntervenIA  |  Page ${pageNum} / ${totalPages}`,
      PAGE_W - MARGIN,
      PAGE_H - 24,
      { align: 'right' }
    );
  };

  // ---- PAGINATION HELPER ----
  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_H - 60) {
      doc.addPage();
      drawHeader();
      y = 110;
    }
  };

  // ---- TEXT WRAPPER ----
  const writeWrapped = (
    text: string,
    x: number,
    maxWidth: number,
    lineHeight: number,
    fontSize: number,
    fontStyle: 'normal' | 'bold' | 'italic' = 'normal',
    color: [number, number, number] = SLATE_700
  ) => {
    doc.setFont('helvetica', fontStyle);
    doc.setFontSize(fontSize);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, maxWidth) as string[];
    for (const line of lines) {
      ensureSpace(lineHeight);
      doc.text(line, x, y);
      y += lineHeight;
    }
  };

  // ---- SECTION TITLE ----
  const sectionTitle = (label: string) => {
    ensureSpace(34);
    y += 8;
    // small indigo bar
    doc.setFillColor(...INDIGO);
    doc.rect(MARGIN, y - 9, 3, 12, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...INDIGO);
    doc.text(label.toUpperCase(), MARGIN + 10, y);
    y += 14;
  };

  // ---- START ----
  drawHeader();
  y = 110;

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...SLATE_900);
  const titleLines = doc.splitTextToSize(intervention.titre || 'Intervention', CONTENT_W) as string[];
  for (const line of titleLines) {
    ensureSpace(26);
    doc.text(line, MARGIN, y);
    y += 24;
  }

  // Meta chips row
  const chips: { label: string; color: [number, number, number] }[] = [];
  if (intervention.duree) chips.push({ label: 'Duree : ' + intervention.duree, color: INDIGO });
  if (intervention.age) chips.push({ label: 'Age : ' + intervention.age + ' ans', color: VIOLET });
  if (intervention.type) chips.push({ label: 'Type : ' + intervention.type, color: EMERALD });

  if (chips.length > 0) {
    y += 4;
    ensureSpace(24);
    let cx = MARGIN;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    for (const chip of chips) {
      const w = doc.getTextWidth(chip.label) + 16;
      if (cx + w > PAGE_W - MARGIN) {
        cx = MARGIN;
        y += 20;
        ensureSpace(20);
      }
      doc.setFillColor(...chip.color);
      doc.roundedRect(cx, y - 10, w, 16, 8, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.text(chip.label, cx + 8, y);
      cx += w + 6;
    }
    y += 16;
  }

  // Problematique highlighted box
  if (intervention.problematique) {
    ensureSpace(50);
    y += 6;
    doc.setFillColor(...SLATE_50);
    doc.setDrawColor(...SLATE_200);
    doc.setLineWidth(0.5);
    const boxStartY = y - 4;
    // Measure
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const probLines = doc.splitTextToSize(intervention.problematique, CONTENT_W - 24) as string[];
    const boxH = 24 + probLines.length * 14;
    doc.roundedRect(MARGIN, boxStartY, CONTENT_W, boxH, 6, 6, 'FD');
    // Label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...INDIGO);
    doc.text('PROBLEMATIQUE', MARGIN + 12, boxStartY + 14);
    // Text
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...SLATE_900);
    let py = boxStartY + 30;
    for (const ln of probLines) {
      doc.text(ln, MARGIN + 12, py);
      py += 14;
    }
    y = boxStartY + boxH + 10;
  }

  // ---- OBJECTIFS ----
  if (intervention.objectifs && intervention.objectifs.length > 0) {
    sectionTitle('Objectifs');
    for (const o of intervention.objectifs) {
      ensureSpace(18);
      doc.setFillColor(...INDIGO);
      doc.circle(MARGIN + 4, y - 3, 2, 'F');
      writeWrapped(o, MARGIN + 14, CONTENT_W - 14, 14, 10, 'normal', SLATE_700);
      y += 2;
    }
  }

  // ---- MATERIEL ----
  if (intervention.materiel && intervention.materiel.length > 0) {
    sectionTitle('Materiel requis');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    let mx = MARGIN;
    ensureSpace(22);
    for (const m of intervention.materiel) {
      const w = doc.getTextWidth(m) + 14;
      if (mx + w > PAGE_W - MARGIN) {
        mx = MARGIN;
        y += 20;
        ensureSpace(20);
      }
      doc.setFillColor(241, 245, 249); // slate-100
      doc.roundedRect(mx, y - 10, w, 16, 4, 4, 'F');
      doc.setTextColor(...SLATE_700);
      doc.text(m, mx + 7, y);
      mx += w + 5;
    }
    y += 14;
  }

  // ---- ETAPES ----
  if (intervention.etapes && intervention.etapes.length > 0) {
    sectionTitle('Deroulement');
    for (const e of intervention.etapes) {
      // Measure description
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const descLines = doc.splitTextToSize(e.description || '', CONTENT_W - 44) as string[];
      const blockH = 24 + descLines.length * 13 + 4;
      ensureSpace(blockH);

      // Number badge
      doc.setFillColor(...INDIGO);
      doc.circle(MARGIN + 10, y + 2, 10, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.text(String(e.numero), MARGIN + 10, y + 5, { align: 'center' });

      // Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...SLATE_900);
      doc.text(e.titre || '', MARGIN + 28, y + 4);
      y += 18;

      // Description
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...SLATE_700);
      for (const ln of descLines) {
        ensureSpace(13);
        doc.text(ln, MARGIN + 28, y);
        y += 13;
      }
      y += 8;
    }
  }

  // ---- CONSEILS ----
  if (intervention.conseils_intervenant && intervention.conseils_intervenant.length > 0) {
    sectionTitle('Conseils pour l\'intervenant');
    // Amber box
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const allLines: string[] = [];
    for (const c of intervention.conseils_intervenant) {
      const lns = doc.splitTextToSize('• ' + c, CONTENT_W - 24) as string[];
      allLines.push(...lns, '');
    }
    if (allLines.length && allLines[allLines.length - 1] === '') allLines.pop();
    const boxH = 16 + allLines.length * 14;
    ensureSpace(boxH + 4);
    doc.setFillColor(...AMBER_BG);
    doc.setDrawColor(...AMBER_BORDER);
    doc.setLineWidth(0.6);
    doc.roundedRect(MARGIN, y - 4, CONTENT_W, boxH, 6, 6, 'FD');
    doc.setTextColor(...AMBER_TEXT);
    let cy = y + 12;
    for (const ln of allLines) {
      doc.text(ln, MARGIN + 12, cy);
      cy += 14;
    }
    y += boxH + 6;
  }

  // ---- INDICATEURS ----
  if (intervention.indicateurs_succes && intervention.indicateurs_succes.length > 0) {
    sectionTitle('Indicateurs de succes');
    for (const ind of intervention.indicateurs_succes) {
      ensureSpace(16);
      doc.setDrawColor(...EMERALD);
      doc.setLineWidth(1.2);
      // Simple check mark: two lines forming a check
      doc.line(MARGIN + 1, y - 3, MARGIN + 4, y);
      doc.line(MARGIN + 4, y, MARGIN + 9, y - 6);
      writeWrapped(ind, MARGIN + 14, CONTENT_W - 14, 14, 10, 'normal', SLATE_700);
      y += 2;
    }
  }

  // ---- ADAPTATIONS ----
  if (intervention.adaptations && intervention.adaptations.length > 0) {
    sectionTitle('Adaptations');
    for (const a of intervention.adaptations) {
      ensureSpace(16);
      doc.setFillColor(...VIOLET);
      doc.circle(MARGIN + 4, y - 3, 2, 'F');
      writeWrapped(a, MARGIN + 14, CONTENT_W - 14, 14, 10, 'normal', SLATE_700);
      y += 2;
    }
  }

  // ---- FOOTERS on every page ----
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(i, totalPages);
  }

  // ---- SAVE ----
  const safeTitle = (intervention.titre || 'intervention')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'intervention';
  const clientSuffix = clientName
    ? '_' + clientName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-')
    : '';
  doc.save(`IntervenIA_${safeTitle}${clientSuffix}.pdf`);
}
