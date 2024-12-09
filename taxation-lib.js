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
  { min: 11_294, max: 28_797, rate: 0.11 },
  { min: 28_797, max: 82_341, rate: 0.3 },
  { min: 82_342, max: 177_106, rate: 0.41 },
  { min: 177_106, max: Infinity, rate: 0.45 },
];

function calculateIR(profit, familyQuotient = 1) {
  const incomePerPart = profit / familyQuotient;
  let taxBreakdown = [];
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
  { min: 0, max: 42_500, rate: IS_REDUCED_TAX_RATE },
  { min: 42_500, max: Infinity, rate: IS_STANDARD_TAX_RATE },
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

// https://www.urssaf.fr/accueil/outils-documentation/taux-baremes/taux-cotisations-ac-plnr.html
const TNS_SOCIAL_CONTRIBUTION_RATES = {
  Cotisation_Maladie_1: [
    { min: 0, max: 18_547, rate: 0 },
    { min: 18_547, max: 27_821, minRate: 0, maxRate: 0.04 },
    { min: 27_821, max: 51_005, minRate: 0.04, maxRate: 0.067 },
    { min: 51_005, max: 231_840, rate: 0.067 },
    { min: 231_840, max: Infinity, rate: 0.065 },
  ],
  Cotisation_Maladie_2: [{ min: 0, max: Infinity, rate: 0.005, cap: 231_840 }],
  Retraite_Base: [
    { min: 0, max: 46_368, rate: 0.1775 },
    { min: 46_368, max: Infinity, rate: 0.006 },
  ],
  Retraite_Complementaire: [
    { min: 0, max: 46_368, rate: 0 },
    { min: 46_368, max: 185_472, rate: 0.14 },
  ],
  Invalidite_Deces: [{ min: 0, max: 46_368, rate: 0.013 }],
  Allocations_Familiales: [
    { min: 0, max: 51_005, rate: 0 },
    { min: 51_005, max: 64_915, minRate: 0, maxRate: 0.031 },
    { min: 64_915, max: Infinity, rate: 0.031 },
  ],
  CSG_CRDS: [
    { min: 0, max: Infinity, rate: 0.097 },
    { min: 0, max: Infinity, rate: 0.067 },
  ],
  Formation_Professionnelle: [{ min: 46_638, max: Infinity, rate: 0.0025 }],
};

// https://www.urssaf.fr/accueil/outils-documentation/taux-baremes/taux-cotisations-ac-plnr.html
const TNS_MINIMUM_SOCIAL_CONTRIBUTION = {
  Cotisation_Maladie_2: 93,
  Retraite_Base: 931,
  Invalidite_Deces: 69,
  Formation_Professionnelle: 134,
};

// URSSAF : Social contributions for TNS (Travailleurs Non Salariés)
// https://entreprendre.service-public.fr/vosdroits/F36239
function calculateSocialContributionsForTNS(income) {
  let contributions = 0;
  let contributionsBreakdown = [];

  for (const [contributionName, brackets] of Object.entries(
    TNS_SOCIAL_CONTRIBUTION_RATES
  )) {
    for (const { min, max, rate, minRate, maxRate, cap } of brackets) {
      if (income > min) {
        const taxableAmount = Math.min(income, max) - min;
        const minContribution =
          TNS_MINIMUM_SOCIAL_CONTRIBUTION[contributionName] || 0;

        if (rate != undefined) {
          const contribution = taxableAmount * rate;
          if (cap && contribution > cap) {
            contributions += cap;
            contributionsBreakdown.push({
              contributionName,
              contribution: cap,
            });
          } else {
            contributions += Math.max(minContribution, contribution.toFixed(0));
            contributionsBreakdown.push({
              contributionName,
              contribution: contribution.toFixed(0),
            });
          }
        } else if (minRate != undefined && maxRate != undefined) {
          const ratio = taxableAmount / (max - min);
          const contribution =
            taxableAmount * (minRate + ratio * (maxRate - minRate));
          contributions += Math.max(minContribution, contribution.toFixed(0));
          contributionsBreakdown.push({
            contributionName,
            contribution: contribution.toFixed(0),
          });
        } else {
          console.log(
            `Error: No rate found for ${contributionName} between ${min} and ${max}`
          );
        }
      }
    }
  }

  // Calculate the social contribution rate
  const contributionsRate = contributions / income;

  return {
    contributionsRate,
    contributions,
    contributionsBreakdown,
  };
}

// =====================================================================================================================

// https://www.cleiss.fr/docs/regimes/regime_francea2.html

// https://www.urssaf.fr/accueil/actualites/plafond-annuel-securite-sociale.html
const PASS = 46_368; // Plafond Annuel de la Sécurité Sociale

// https://www.urssaf.fr/accueil/outils-documentation/taux-baremes/taux-cotisations-secteur-prive.html
const EMPLOYER_CONTRIBUTION_RATES = {
  Maladie: {
    min: 0,
    max: Infinity,
    rate: 0.013,
  },
  CSA: {
    min: 0,
    max: Infinity,
    rate: 0.003,
  },
  Vieillesse_Deplafonnee: {
    min: 0,
    max: Infinity,
    rate: 0.0202,
  },
  Vieillesse_Plafonnee: {
    min: 0,
    rate: 0.0855,
    max: Infinity,
    cap: PASS,
  },
  Allocations_Familiales: {
    min: 0,
    max: Infinity,
    rate: 0.0525,
  },
  Dialogue_Social: {
    min: 0,
    max: Infinity,
    rate: 0.00016,
  },
  Chomage: {
    min: 0,
    max: Infinity,
    rate: 0.0405,
    cap: 4 * PASS,
  },
  AGS: {
    min: 0,
    max: Infinity,
    rate: 0.0025,
    cap: 4 * PASS,
  },
  FNAL: {
    min: 0,
    max: Infinity,
    rate: 0.001,
  },
  CPF_CDD: {
    min: 0,
    max: Infinity,
    rate: 0.01,
  },
  Agirc_Arrco_Retraite_Complementaire_Tranche_1: {
    min: 0,
    max: Infinity,
    rate: 0.0472,
    cap: PASS,
  },
  Agirc_Arrco_Retraite_Complementaire_Tranche_2: {
    min: 0,
    max: Infinity,
    rate: 0.1295,
    cap: 8 * PASS,
  },
  CEG_Tranche_1: {
    min: 0,
    max: Infinity,
    rate: 0.0129,
    cap: PASS,
  },
  CEG_Tranche_2: {
    min: 0,
    max: Infinity,
    rate: 0.0162,
    cap: 8 * PASS,
  },
};

// https://www.urssaf.fr/accueil/outils-documentation/taux-baremes/taux-cotisations-secteur-prive.html
const SALARIAL_CONTRIBUTION_RATES = {
  Vieillesse_Deplafonnee: {
    min: 0,
    max: Infinity,
    rate: 0.004,
  },
  Vieillesse_Plafonnee: {
    min: 0,
    max: Infinity,
    rate: 0.069,
    cap: PASS,
  },
  CSG: {
    min: 0,
    max: Infinity,
    rate: 0.092,
    cap: 4 * PASS,
  },
  CRDS: {
    min: 0,
    max: Infinity,
    rate: 0.005,
    cap: 4 * PASS,
  },
  Agirc_Arrco_Retraite_Complementaire_Tranche_1: {
    min: 0,
    max: Infinity,
    rate: 0.0315,
    cap: PASS,
  },
  Agirc_Arrco_Retraite_Complementaire_Tranche_2: {
    min: 0,
    max: Infinity,
    rate: 0.0864,
    cap: 8 * PASS,
  },
  CEG_Tranche_1: {
    min: 0,
    max: Infinity,
    rate: 0.0086,
    cap: PASS,
  },
  CEG_Tranche_2: {
    min: 0,
    max: Infinity,
    rate: 0.0108,
    cap: 8 * PASS,
  },
};

function calculateSocialContributionsForAssimilatedEmployee(income) {
  let employerContributions = 0;
  let employerContributionsBreakdown = [];

  for (const [contributionName, { min, max, rate, cap }] of Object.entries(
    EMPLOYER_CONTRIBUTION_RATES
  )) {
    if (income > min) {
      const taxableAmount = Math.min(income, max) - min;
      const contribution = Math.min(taxableAmount * rate, cap || Infinity);
      employerContributions += contribution;
      employerContributionsBreakdown.push({
        contributionName,
        contribution: contribution.toFixed(0),
      });
    }
  }

  let salarialContributions = 0;
  let salarialContributionsBreakdown = [];

  for (const [contributionName, { min, max, rate, cap }] of Object.entries(
    SALARIAL_CONTRIBUTION_RATES
  )) {
    if (income > min) {
      const taxableAmount = Math.min(income, max) - min;
      const contribution = Math.min(taxableAmount * rate, cap || Infinity);
      salarialContributions += contribution;
      salarialContributionsBreakdown.push({
        contributionName,
        contribution: contribution.toFixed(0),
      });
    }
  }

  const totalContributions = employerContributions + salarialContributions;
  const totalContributionsRate = totalContributions / income;

  return {
    totalContributions,
    totalContributionsRate,
    employerContributions,
    employerContributionsBreakdown,
    salarialContributions,
    salarialContributionsBreakdown,
  };
}

// =====================================================================================================================

// https://www.economie.gouv.fr/particuliers/prelevement-forfaitaire-unique-pfu
const PFU_RATE = 0.3;
const PFU_IR_RATE = 0.128;
const PFU_PS_RATE = 0.172;
