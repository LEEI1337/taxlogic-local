export interface TaxBracket {
  min: number;
  max: number | null;
  rate: number;
}

export interface PendlerBracket {
  minKm: number;
  maxKm: number | null;
  amount: number;
}

export interface TieredFamilyCredit {
  firstChild: number;
  secondChildIncrement: number;
  additionalChildIncrement: number;
}

export interface TaxRuleCredits {
  werbungskostenPauschale: number;
  verkehrsabsetzbetrag: number;
  arbeitnehmerabsetzbetrag: number;
  churchTaxMax: number;
  familienbonusPerChild: number;
  familienbonusPerChildAdult: number;
  alleinverdiener: TieredFamilyCredit;
  alleinerzieher: TieredFamilyCredit;
}

export interface HomeOfficeRules {
  perDay: number;
  maxAmount: number;
  maxDays: number;
}

export interface ChildcareRules {
  maxPerChild: number;
  sharedCustodyFactor: number;
  maxAge: number;
}

export interface MedicalRules {
  defaultSelfRetentionRate: number;
  manyChildrenSelfRetentionRate: number;
  singleWithTwoChildrenRate: number;
  singleWithThreeOrMoreChildrenRate: number;
  disabilityRate: number;
}

export interface PendlerRules {
  klein: PendlerBracket[];
  gross: PendlerBracket[];
}

export interface TaxRuleMetadata {
  lawYear: number;
  verificationStatus: string;
  notes?: string;
  sources: string[];
}

export interface TaxRulePack {
  year: number;
  version: string;
  verifiedAt: string;
  staleAfterDays: number;
  metadata: TaxRuleMetadata;
  taxBrackets: TaxBracket[];
  credits: TaxRuleCredits;
  homeOffice: HomeOfficeRules;
  childcare: ChildcareRules;
  medical: MedicalRules;
  pendlerpauschale: PendlerRules;
}

export type TaxRuleState = 'ok' | 'missing' | 'stale' | 'invalid' | 'unsupportedYear';

export interface TaxRuleStatus {
  year: number;
  state: TaxRuleState;
  message: string;
  supportedYears: number[];
  packPath?: string;
  verifiedAt?: string;
  daysSinceVerification?: number;
}
