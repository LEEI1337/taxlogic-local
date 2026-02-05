/**
 * TaxLogic.local - Form Generator Service
 *
 * Generates Austrian tax forms:
 * - L1: Arbeitnehmerveranlagung (Employee tax return)
 * - L1ab: Beilage zur Arbeitnehmerveranlagung (Supplement)
 * - L1k: Beilage für Kinder (Children supplement)
 *
 * Uses PDFKit to create fillable PDF forms matching official Finanzamt layouts.
 */

import * as fs from 'fs';
import * as path from 'path';

import PDFDocument from 'pdfkit';

// ========================================
// Type Definitions
// ========================================

export interface L1FormData {
  // Personal Information
  steuernummer?: string;
  sozialversicherungsnummer: string;
  familienname: string;
  vorname: string;
  geburtsdatum: string;
  strasse: string;
  hausnummer: string;
  plz: string;
  ort: string;
  email?: string;
  telefon?: string;

  // Tax Year
  veranlagungsjahr: number;

  // Employment Income (Kennzahl 245)
  bruttoeinkunfte?: number;
  lohnsteuer?: number;

  // Deductions - Werbungskosten
  pendlerpauschale?: number;           // KZ 718 - Commute
  pendlerkilometer?: number;           // Distance in km
  pendlerEuroProMonat?: number;        // KZ 719
  arbeitsmittel?: number;              // KZ 719 - Work equipment
  fortbildungskosten?: number;         // KZ 720 - Education
  homeOfficePauschale?: number;        // KZ 724 - Home office
  homeOfficeTage?: number;             // Number of days
  doppelteHaushaltsfuehrung?: number;  // KZ 721
  reisekosten?: number;                // KZ 722
  sonstigeWerbungskosten?: number;     // KZ 723

  // Sonderausgaben (Special expenses)
  kirchenbeitrag?: number;             // KZ 458
  spendenBeguenstigte?: number;        // KZ 459
  versicherungspraemien?: number;      // KZ 455

  // Außergewöhnliche Belastungen (Extraordinary burdens)
  krankheitskosten?: number;           // KZ 730
  behinderung?: boolean;
  behinderungsgrad?: number;
  kinderbetreuungskosten?: number;     // KZ 731

  // Bank Account for Refund
  iban?: string;
  bic?: string;
  bankname?: string;
}

export interface L1abFormData {
  steuernummer?: string;
  veranlagungsjahr: number;

  // Business Income
  einnahmenGewerbe?: number;
  ausgabenGewerbe?: number;
  gewinnGewerbe?: number;

  // Rental Income
  einnahmenVermietung?: number;
  ausgabenVermietung?: number;
  gewinnVermietung?: number;

  // Capital Gains
  kapitaleinkuenfte?: number;
  quellensteuer?: number;
}

export interface L1kFormData {
  steuernummer?: string;
  veranlagungsjahr: number;

  // Children Information
  kinder: ChildData[];

  // Childcare Costs
  kinderbetreuungskostenGesamt?: number;
  kinderbetreuungszuschuss?: number;

  // Family Bonus
  familienbonusPlus?: boolean;
  familienbonusBetrag?: number;

  // Alleinverdiener/Alleinerzieher
  alleinverdiener?: boolean;
  alleinerzieher?: boolean;
}

export interface ChildData {
  vorname: string;
  nachname: string;
  geburtsdatum: string;
  svnr?: string;
  imHaushalt: boolean;
  familienbeihilfe: boolean;
}

export interface GeneratedForm {
  formType: 'L1' | 'L1ab' | 'L1k';
  pdfPath: string;
  jsonData: Record<string, unknown>;
  generatedAt: string;
}

// ========================================
// Form Generator Service Class
// ========================================

class FormGeneratorService {
  private outputPath: string;

  constructor() {
    this.outputPath = path.join(process.cwd(), 'data', 'output');
  }

  /**
   * Set the output path for generated forms
   */
  setOutputPath(outputPath: string): void {
    this.outputPath = outputPath;
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }
  }

  /**
   * Generate L1 form (Main employee tax return)
   */
  async generateL1(data: L1FormData): Promise<GeneratedForm> {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 }
    });

    const filename = `L1_${data.veranlagungsjahr}_${Date.now()}.pdf`;
    const filepath = path.join(this.outputPath, filename);

    // Ensure output directory exists
    if (!fs.existsSync(this.outputPath)) {
      fs.mkdirSync(this.outputPath, { recursive: true });
    }

    const writeStream = fs.createWriteStream(filepath);
    doc.pipe(writeStream);

    // Header
    this.addFormHeader(doc, 'L1', 'Erklärung zur Arbeitnehmerveranlagung', data.veranlagungsjahr);

    // Personal Information Section
    doc.moveDown(2);
    this.addSectionHeader(doc, 'A. Persönliche Daten');

    doc.fontSize(10);
    this.addFormField(doc, 'Sozialversicherungsnummer', data.sozialversicherungsnummer);
    this.addFormField(doc, 'Steuernummer', data.steuernummer || '(wird vom Finanzamt vergeben)');
    this.addFormField(doc, 'Familienname', data.familienname);
    this.addFormField(doc, 'Vorname', data.vorname);
    this.addFormField(doc, 'Geburtsdatum', data.geburtsdatum);

    doc.moveDown();
    this.addFormField(doc, 'Adresse', `${data.strasse} ${data.hausnummer}, ${data.plz} ${data.ort}`);
    if (data.email) this.addFormField(doc, 'E-Mail', data.email);
    if (data.telefon) this.addFormField(doc, 'Telefon', data.telefon);

    // Income Section
    doc.moveDown(2);
    this.addSectionHeader(doc, 'B. Einkünfte aus nichtselbständiger Arbeit');

    if (data.bruttoeinkunfte) {
      this.addKennzahlField(doc, '245', 'Bruttobezüge laut Lohnzettel', data.bruttoeinkunfte);
    }
    if (data.lohnsteuer) {
      this.addKennzahlField(doc, '246', 'Einbehaltene Lohnsteuer', data.lohnsteuer);
    }

    // Werbungskosten Section
    doc.moveDown(2);
    this.addSectionHeader(doc, 'C. Werbungskosten');

    if (data.pendlerpauschale) {
      this.addKennzahlField(doc, '718', `Pendlerpauschale (${data.pendlerkilometer || '?'} km)`, data.pendlerpauschale);
    }
    if (data.arbeitsmittel) {
      this.addKennzahlField(doc, '719', 'Arbeitsmittel', data.arbeitsmittel);
    }
    if (data.fortbildungskosten) {
      this.addKennzahlField(doc, '720', 'Aus- und Fortbildungskosten', data.fortbildungskosten);
    }
    if (data.homeOfficePauschale) {
      this.addKennzahlField(doc, '724', `Home Office Pauschale (${data.homeOfficeTage || '?'} Tage)`, data.homeOfficePauschale);
    }
    if (data.reisekosten) {
      this.addKennzahlField(doc, '722', 'Reisekosten', data.reisekosten);
    }
    if (data.sonstigeWerbungskosten) {
      this.addKennzahlField(doc, '723', 'Sonstige Werbungskosten', data.sonstigeWerbungskosten);
    }

    // Calculate total Werbungskosten
    const totalWerbungskosten =
      (data.pendlerpauschale || 0) +
      (data.arbeitsmittel || 0) +
      (data.fortbildungskosten || 0) +
      (data.homeOfficePauschale || 0) +
      (data.reisekosten || 0) +
      (data.sonstigeWerbungskosten || 0);

    if (totalWerbungskosten > 0) {
      doc.moveDown();
      doc.font('Helvetica-Bold');
      doc.text(`Summe Werbungskosten: € ${this.formatCurrency(totalWerbungskosten)}`, { align: 'right' });
      doc.font('Helvetica');
    }

    // Sonderausgaben Section
    doc.moveDown(2);
    this.addSectionHeader(doc, 'D. Sonderausgaben');

    if (data.kirchenbeitrag) {
      this.addKennzahlField(doc, '458', 'Kirchenbeitrag', data.kirchenbeitrag);
    }
    if (data.spendenBeguenstigte) {
      this.addKennzahlField(doc, '459', 'Spenden an begünstigte Organisationen', data.spendenBeguenstigte);
    }
    if (data.versicherungspraemien) {
      this.addKennzahlField(doc, '455', 'Versicherungsprämien', data.versicherungspraemien);
    }

    // Außergewöhnliche Belastungen Section
    doc.moveDown(2);
    this.addSectionHeader(doc, 'E. Außergewöhnliche Belastungen');

    if (data.krankheitskosten) {
      this.addKennzahlField(doc, '730', 'Krankheitskosten', data.krankheitskosten);
    }
    if (data.kinderbetreuungskosten) {
      this.addKennzahlField(doc, '731', 'Kinderbetreuungskosten', data.kinderbetreuungskosten);
    }
    if (data.behinderung) {
      doc.text(`Behinderung: Ja (Grad: ${data.behinderungsgrad || '?'}%)`);
    }

    // Bank Details Section
    if (data.iban) {
      doc.moveDown(2);
      this.addSectionHeader(doc, 'F. Bankverbindung für Gutschrift');
      this.addFormField(doc, 'IBAN', data.iban);
      if (data.bic) this.addFormField(doc, 'BIC', data.bic);
      if (data.bankname) this.addFormField(doc, 'Bank', data.bankname);
    }

    // Footer
    doc.moveDown(3);
    this.addFormFooter(doc);

    doc.end();

    // Wait for the file to be written
    await new Promise<void>((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    console.log(`[FormGenerator] Generated L1 form: ${filepath}`);

    return {
      formType: 'L1',
      pdfPath: filepath,
      jsonData: data as unknown as Record<string, unknown>,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Generate L1ab form (Supplement for additional income)
   */
  async generateL1ab(data: L1abFormData): Promise<GeneratedForm> {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 }
    });

    const filename = `L1ab_${data.veranlagungsjahr}_${Date.now()}.pdf`;
    const filepath = path.join(this.outputPath, filename);

    if (!fs.existsSync(this.outputPath)) {
      fs.mkdirSync(this.outputPath, { recursive: true });
    }

    const writeStream = fs.createWriteStream(filepath);
    doc.pipe(writeStream);

    // Header
    this.addFormHeader(doc, 'L1ab', 'Beilage zur Arbeitnehmerveranlagung', data.veranlagungsjahr);

    // Business Income
    if (data.einnahmenGewerbe || data.ausgabenGewerbe) {
      doc.moveDown(2);
      this.addSectionHeader(doc, 'Einkünfte aus Gewerbebetrieb');

      this.addFormField(doc, 'Einnahmen', this.formatCurrency(data.einnahmenGewerbe || 0));
      this.addFormField(doc, 'Ausgaben', this.formatCurrency(data.ausgabenGewerbe || 0));
      this.addFormField(doc, 'Gewinn/Verlust', this.formatCurrency(data.gewinnGewerbe || 0));
    }

    // Rental Income
    if (data.einnahmenVermietung || data.ausgabenVermietung) {
      doc.moveDown(2);
      this.addSectionHeader(doc, 'Einkünfte aus Vermietung und Verpachtung');

      this.addFormField(doc, 'Einnahmen', this.formatCurrency(data.einnahmenVermietung || 0));
      this.addFormField(doc, 'Ausgaben', this.formatCurrency(data.ausgabenVermietung || 0));
      this.addFormField(doc, 'Gewinn/Verlust', this.formatCurrency(data.gewinnVermietung || 0));
    }

    // Capital Gains
    if (data.kapitaleinkuenfte) {
      doc.moveDown(2);
      this.addSectionHeader(doc, 'Einkünfte aus Kapitalvermögen');

      this.addFormField(doc, 'Kapitaleinkünfte', this.formatCurrency(data.kapitaleinkuenfte));
      if (data.quellensteuer) {
        this.addFormField(doc, 'Bereits bezahlte Quellensteuer', this.formatCurrency(data.quellensteuer));
      }
    }

    // Footer
    doc.moveDown(3);
    this.addFormFooter(doc);

    doc.end();

    await new Promise<void>((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    console.log(`[FormGenerator] Generated L1ab form: ${filepath}`);

    return {
      formType: 'L1ab',
      pdfPath: filepath,
      jsonData: data as unknown as Record<string, unknown>,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Generate L1k form (Children supplement)
   */
  async generateL1k(data: L1kFormData): Promise<GeneratedForm> {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 }
    });

    const filename = `L1k_${data.veranlagungsjahr}_${Date.now()}.pdf`;
    const filepath = path.join(this.outputPath, filename);

    if (!fs.existsSync(this.outputPath)) {
      fs.mkdirSync(this.outputPath, { recursive: true });
    }

    const writeStream = fs.createWriteStream(filepath);
    doc.pipe(writeStream);

    // Header
    this.addFormHeader(doc, 'L1k', 'Beilage für Kinder', data.veranlagungsjahr);

    // Children List
    doc.moveDown(2);
    this.addSectionHeader(doc, 'Angaben zu den Kindern');

    for (let i = 0; i < data.kinder.length; i++) {
      const kind = data.kinder[i];
      doc.moveDown();
      doc.font('Helvetica-Bold').text(`Kind ${i + 1}:`);
      doc.font('Helvetica');
      this.addFormField(doc, 'Name', `${kind.vorname} ${kind.nachname}`);
      this.addFormField(doc, 'Geburtsdatum', kind.geburtsdatum);
      if (kind.svnr) this.addFormField(doc, 'SVNR', kind.svnr);
      this.addFormField(doc, 'Im Haushalt lebend', kind.imHaushalt ? 'Ja' : 'Nein');
      this.addFormField(doc, 'Familienbeihilfe', kind.familienbeihilfe ? 'Ja' : 'Nein');
    }

    // Childcare Costs
    if (data.kinderbetreuungskostenGesamt) {
      doc.moveDown(2);
      this.addSectionHeader(doc, 'Kinderbetreuungskosten');
      this.addFormField(doc, 'Gesamtkosten', this.formatCurrency(data.kinderbetreuungskostenGesamt));
      if (data.kinderbetreuungszuschuss) {
        this.addFormField(doc, 'Abzüglich Zuschuss Arbeitgeber', this.formatCurrency(data.kinderbetreuungszuschuss));
      }
    }

    // Family Bonus
    if (data.familienbonusPlus) {
      doc.moveDown(2);
      this.addSectionHeader(doc, 'Familienbonus Plus');
      this.addFormField(doc, 'Beantragt', 'Ja');
      if (data.familienbonusBetrag) {
        this.addFormField(doc, 'Betrag', this.formatCurrency(data.familienbonusBetrag));
      }
    }

    // Status
    doc.moveDown(2);
    this.addSectionHeader(doc, 'Status');
    if (data.alleinverdiener) doc.text('✓ Alleinverdienerabsetzbetrag beantragt');
    if (data.alleinerzieher) doc.text('✓ Alleinerzieherabsetzbetrag beantragt');

    // Footer
    doc.moveDown(3);
    this.addFormFooter(doc);

    doc.end();

    await new Promise<void>((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    console.log(`[FormGenerator] Generated L1k form: ${filepath}`);

    return {
      formType: 'L1k',
      pdfPath: filepath,
      jsonData: data as unknown as Record<string, unknown>,
      generatedAt: new Date().toISOString()
    };
  }

  // ========================================
  // Helper Methods
  // ========================================

  private addFormHeader(doc: PDFKit.PDFDocument, formCode: string, title: string, year: number): void {
    doc.fontSize(8).text('Republik Österreich - Bundesministerium für Finanzen', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(20).font('Helvetica-Bold').text(formCode, { align: 'center' });
    doc.fontSize(14).font('Helvetica').text(title, { align: 'center' });
    doc.fontSize(12).text(`Veranlagungsjahr ${year}`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(8).fillColor('gray').text('Dieses Dokument wurde von TaxLogic.local generiert', { align: 'center' });
    doc.fillColor('black');
    doc.moveDown();

    // Horizontal line
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  }

  private addSectionHeader(doc: PDFKit.PDFDocument, title: string): void {
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica-Bold').text(title);
    doc.font('Helvetica');
    doc.moveDown(0.5);
  }

  private addFormField(doc: PDFKit.PDFDocument, label: string, value: string): void {
    doc.fontSize(10);
    const labelWidth = 200;
    doc.text(`${label}:`, { continued: true, width: labelWidth });
    doc.text(` ${value}`);
  }

  private addKennzahlField(doc: PDFKit.PDFDocument, kz: string, label: string, value: number): void {
    doc.fontSize(10);
    doc.text(`KZ ${kz}: ${label}`, { continued: true, width: 350 });
    doc.text(`€ ${this.formatCurrency(value)}`, { align: 'right' });
  }

  private addFormFooter(doc: PDFKit.PDFDocument): void {
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown();

    doc.fontSize(8).fillColor('gray');
    doc.text(
      'Ich versichere, dass ich die Angaben nach bestem Wissen und Gewissen richtig und vollständig gemacht habe.',
      { align: 'center' }
    );
    doc.moveDown(2);

    doc.text('_________________________________', { align: 'left', continued: true });
    doc.text('_________________________________', { align: 'right' });
    doc.text('Ort, Datum', { align: 'left', continued: true });
    doc.text('Unterschrift', { align: 'right' });

    doc.moveDown(2);
    doc.text(`Generiert am: ${new Date().toLocaleString('de-AT')}`, { align: 'center' });
    doc.text('TaxLogic.local - 100% lokal & privat', { align: 'center' });
    doc.fillColor('black');
  }

  private formatCurrency(value: number): string {
    return value.toLocaleString('de-AT', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
}

// Singleton instance
export const formGenerator = new FormGeneratorService();
export default FormGeneratorService;
