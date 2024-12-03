// https://www.economie.gouv.fr/particuliers/decote-impot-revenu
const DECOTE_APPLICATION_THRESHOLD = [1929, 3191]; // The threshold for applying decote for 1 and 2 parts
const DECOTE_MAX = [873, 1444]; // The max decote amount for 1 and 2 parts
const DECOTE_PERCENTAGE = 0.4525; // The percentage of the decote

function calculateDecote(tax, familyQuotient = 1) {
  const decoteThreshold =
    familyQuotient == 1
      ? DECOTE_APPLICATION_THRESHOLD[0]
      : DECOTE_APPLICATION_THRESHOLD[1];

  const decoteMax = familyQuotient == 1 ? DECOTE_MAX[0] : DECOTE_MAX[1];

  if (tax <= decoteThreshold) {
    let decote = decoteMax - tax * DECOTE_PERCENTAGE;
    if (tax - decote > 0) {
      return decoteMax - tax * DECOTE_PERCENTAGE;
    } else {
      return tax;
    }
  }
  return 0;
}

// =====================================================================================================================

// https://www.economie.gouv.fr/particuliers/tranches-imposition-impot-revenu
const TAX_RATES_IR = [
  { min: 0, max: 11294, rate: 0 },
  { min: 11294, max: 28797, rate: 0.11 },
  { min: 28797, max: 82341, rate: 0.3 },
  { min: 82342, max: 177106, rate: 0.41 },
  { min: 177106, max: Infinity, rate: 0.45 },
];

function calculateIR(profit, familyQuotient = 1) {
  const incomePerPart = profit / familyQuotient;
  const taxBreakdown = [];
  let tax = 0;

  for (const { min, max, rate } of TAX_RATES_IR) {
    if (incomePerPart > min) {
      const taxableAmount = Math.min(max - min, incomePerPart - min);
      const taxForBracket = taxableAmount * rate;
      tax += taxForBracket;

      taxBreakdown.push({
        range: `${min * familyQuotient} - ${
          max === Infinity ? "∞" : max * familyQuotient
        }`,
        taxableAmount: (taxableAmount * familyQuotient).toFixed(0),
        taxForBracket: (taxForBracket * familyQuotient).toFixed(0),
      });
    }
  }

  tax = tax * familyQuotient;
  let decote = calculateDecote(tax, familyQuotient);
  let taxAfterDecote = Math.max(0, tax - decote);

  return { tax, taxAfterDecote, taxBreakdown, decote };
}

// =====================================================================================================================

const PME_REVENUE_THRESHOLD = 10_000_000; // Seuil de chiffre d'affaires pour les PME
const IS_REDUCED_TAX_RATE = 0.15; // Taux réduit de l'IS pour les PME
const IS_STANDARD_TAX_RATE = 0.25; // Taux standard de l'IS

// https://entreprendre.service-public.fr/vosdroits/F23575
const TAX_RATES_IS = [
  { min: 0, max: 42500, rate: IS_REDUCED_TAX_RATE },
  { min: 42500, max: Infinity, rate: IS_STANDARD_TAX_RATE },
];

function calculateIS(profit) {
  let tax = 0;
  if (profit <= PME_REVENUE_THRESHOLD) {
    for (let { min, max, rate } of TAX_RATES_IS) {
      if (profit > min) {
        const taxableIncome = Math.min(profit, max) - min;
        tax += taxableIncome * rate;
      }
    }
  } else {
    tax = profit * IS_STANDARD_TAX_RATE;
  }
  return tax;
}

// =====================================================================================================================

// https://entreprendre.service-public.fr/vosdroits/F36239
const EURL_SOCIAL_CONTRIBUTION_RATE = 0.45;

// https://entreprendre.service-public.fr/vosdroits/F36240
const SASU_SOCIAL_CONTRIBUTION_RATE = 0.82;

// https://www.urssaf.fr/accueil/outils-documentation/taux-baremes/taux-cotisations-ac-plnr.html
const EURL_MINIMUM_SOCIAL_CONTRIBUTION = 93 + 931 + 69 + 134;

// https://www.economie.gouv.fr/particuliers/prelevement-forfaitaire-unique-pfu
const PFU_RATE = 0.3;
const PFU_IR_RATE = 0.128;
const PFU_PS_RATE = 0.172;
