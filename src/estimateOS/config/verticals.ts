// ─── Built-in vertical configurations ────────────────────────────────────────
// Roofing-specific pricing rules and intake questions are defined here.
// For future verticals (HVAC, landscaping, etc.) add new VerticalConfig objects.

import { VerticalConfig } from '../models/types';

// ─── Roofing ──────────────────────────────────────────────────────────────────

const ROOFING_VERTICAL: VerticalConfig = {
  id: 'roofing',
  name: 'Roofing',
  icon: '🏠',
  currency: 'USD',
  variancePct: 0.15,
  disclaimerText:
    'This estimate is based on information provided and is subject to change after on-site inspection. Final pricing may vary based on actual roof conditions, materials availability, and hidden damage discovered during work.',

  services: [
    { id: 'roof_replacement', name: 'Roof Replacement',      baseMin: 6000,  baseMax: 14000 },
    { id: 'roof_repair',      name: 'Roof Repair',           baseMin: 400,   baseMax: 2500  },
    { id: 'leak_repair',      name: 'Leak Repair',           baseMin: 250,   baseMax: 1200  },
    { id: 'flashing',         name: 'Flashing / Skylights',  baseMin: 300,   baseMax: 2000  },
    { id: 'gutters',          name: 'Gutters',               baseMin: 600,   baseMax: 3500  },
    { id: 'inspection',       name: 'Inspection / Assessment', baseMin: 150, baseMax: 400   },
  ],

  intakeQuestions: [
    {
      id: 'roof_area_sqft',
      label: 'Roof area (sq ft)',
      type: 'number',
      required: true,
      placeholder: 'e.g. 1800',
      unit: 'sq ft',
      min: 100,
      max: 15000,
    },
    {
      id: 'stories',
      label: 'Number of stories',
      type: 'select',
      required: true,
      options: ['1 story', '2 stories', '3+ stories'],
    },
    {
      id: 'pitch',
      label: 'Roof pitch',
      type: 'select',
      required: true,
      options: ['Low (1–3/12)', 'Medium (4–6/12)', 'Steep (7–9/12)', 'Very steep (10+/12)'],
    },
    {
      id: 'material',
      label: 'Roofing material',
      type: 'select',
      required: true,
      options: ['Asphalt shingles', 'Metal (standing seam)', 'Metal (corrugated)', 'Tile', 'Flat/TPO/EPDM', 'Cedar shake', 'Other'],
    },
    {
      id: 'existing_layers',
      label: 'Existing shingle layers',
      type: 'select',
      options: ['1 layer (tear-off needed)', '2+ layers (tear-off needed)', 'Unknown'],
    },
    {
      id: 'decking_damage',
      label: 'Visible decking damage?',
      type: 'boolean',
    },
    {
      id: 'damage_extent',
      label: 'Damage extent',
      type: 'select',
      options: ['Minor (< 10%)', 'Moderate (10–30%)', 'Major (30–60%)', 'Full replacement'],
    },
    {
      id: 'gutters_included',
      label: 'Replace gutters too?',
      type: 'boolean',
    },
    {
      id: 'skylight_count',
      label: 'Number of skylights',
      type: 'number',
      placeholder: '0',
      unit: 'skylights',
      min: 0,
      max: 20,
    },
    {
      id: 'chimney',
      label: 'Chimney flashing needed?',
      type: 'boolean',
    },
    {
      id: 'access_difficulty',
      label: 'Roof access difficulty',
      type: 'select',
      options: ['Easy (flat driveway)', 'Moderate (some obstacles)', 'Difficult (tight access, sloped lot)'],
    },
    {
      id: 'permit_needed',
      label: 'Permit likely required?',
      type: 'boolean',
    },
    {
      id: 'emergency',
      label: 'Emergency / storm damage?',
      type: 'boolean',
    },
  ],

  pricingRules: [
    // ── Base labor per sq ft ──────────────────────────────────────────────────
    {
      type: 'per_unit',
      id: 'labor_per_sqft',
      label: 'Labor (per sq ft)',
      bucket: 'labor',
      questionId: 'roof_area_sqft',
      unitMin: 1.80,
      unitMax: 3.20,
      unitLabel: 'sq ft',
      unitCap: 10000,
    },

    // ── Material cost per sq ft ───────────────────────────────────────────────
    {
      type: 'per_unit',
      id: 'materials_per_sqft',
      label: 'Materials (per sq ft)',
      bucket: 'materials',
      questionId: 'roof_area_sqft',
      unitMin: 1.20,
      unitMax: 2.80,
      unitLabel: 'sq ft',
      unitCap: 10000,
    },

    // ── Stories / height multiplier ───────────────────────────────────────────
    {
      type: 'conditional_addon',
      id: 'stories_2',
      label: 'Two-story access',
      bucket: 'labor',
      questionId: 'stories',
      triggerValue: '2 stories',
      valueMin: 400,
      valueMax: 900,
    },
    {
      type: 'conditional_addon',
      id: 'stories_3plus',
      label: 'Three+ story access',
      bucket: 'labor',
      questionId: 'stories',
      triggerValue: '3+ stories',
      valueMin: 900,
      valueMax: 2000,
    },

    // ── Pitch upcharge ────────────────────────────────────────────────────────
    {
      type: 'conditional_addon',
      id: 'pitch_steep',
      label: 'Steep pitch upcharge',
      bucket: 'labor',
      questionId: 'pitch',
      triggerValue: 'Steep (7–9/12)',
      valueMin: 500,
      valueMax: 1200,
    },
    {
      type: 'conditional_addon',
      id: 'pitch_very_steep',
      label: 'Very steep pitch upcharge',
      bucket: 'labor',
      questionId: 'pitch',
      triggerValue: 'Very steep (10+/12)',
      valueMin: 1200,
      valueMax: 2800,
    },

    // ── Premium materials ─────────────────────────────────────────────────────
    {
      type: 'conditional_addon',
      id: 'material_metal_standing',
      label: 'Metal (standing seam) premium',
      bucket: 'materials',
      questionId: 'material',
      triggerValue: 'Metal (standing seam)',
      valueMin: 2000,
      valueMax: 5000,
    },
    {
      type: 'conditional_addon',
      id: 'material_tile',
      label: 'Tile premium',
      bucket: 'materials',
      questionId: 'material',
      triggerValue: 'Tile',
      valueMin: 1500,
      valueMax: 4000,
    },
    {
      type: 'conditional_addon',
      id: 'material_cedar',
      label: 'Cedar shake premium',
      bucket: 'materials',
      questionId: 'material',
      triggerValue: 'Cedar shake',
      valueMin: 2500,
      valueMax: 6000,
    },

    // ── Decking / structural ──────────────────────────────────────────────────
    {
      type: 'conditional_addon',
      id: 'decking_damage',
      label: 'Decking repair / replacement',
      bucket: 'materials',
      questionId: 'decking_damage',
      triggerValue: true,
      valueMin: 800,
      valueMax: 2500,
    },

    // ── Existing shingle tear-off ─────────────────────────────────────────────
    {
      type: 'conditional_addon',
      id: 'tearoff_2layers',
      label: 'Two-layer tear-off',
      bucket: 'labor',
      questionId: 'existing_layers',
      triggerValue: '2+ layers (tear-off needed)',
      valueMin: 600,
      valueMax: 1800,
    },

    // ── Gutters ───────────────────────────────────────────────────────────────
    {
      type: 'conditional_addon',
      id: 'gutters',
      label: 'Gutter replacement',
      bucket: 'materials',
      questionId: 'gutters_included',
      triggerValue: true,
      valueMin: 800,
      valueMax: 2800,
    },

    // ── Skylights ─────────────────────────────────────────────────────────────
    {
      type: 'per_unit',
      id: 'skylights',
      label: 'Skylight flashing',
      bucket: 'materials',
      questionId: 'skylight_count',
      unitMin: 200,
      unitMax: 450,
      unitLabel: 'skylight',
      unitCap: 10,
    },

    // ── Chimney flashing ──────────────────────────────────────────────────────
    {
      type: 'conditional_addon',
      id: 'chimney',
      label: 'Chimney flashing',
      bucket: 'materials',
      questionId: 'chimney',
      triggerValue: true,
      valueMin: 300,
      valueMax: 700,
    },

    // ── Access difficulty ─────────────────────────────────────────────────────
    {
      type: 'conditional_addon',
      id: 'access_difficult',
      label: 'Difficult access surcharge',
      bucket: 'access',
      questionId: 'access_difficulty',
      triggerValue: 'Difficult (tight access, sloped lot)',
      valueMin: 400,
      valueMax: 1000,
    },

    // ── Permit ────────────────────────────────────────────────────────────────
    {
      type: 'conditional_addon',
      id: 'permit',
      label: 'Permit fees',
      bucket: 'other',
      questionId: 'permit_needed',
      triggerValue: true,
      valueMin: 150,
      valueMax: 400,
    },

    // ── Emergency / storm response ────────────────────────────────────────────
    {
      type: 'multiplier',
      id: 'emergency_multiplier',
      label: 'Emergency response',
      bucket: 'risk',
      questionId: 'emergency',
      answerValue: true,
      valueMin: 1.10,
      valueMax: 1.25,
    },

    // ── Disposal ──────────────────────────────────────────────────────────────
    {
      type: 'flat_fee',
      id: 'disposal',
      label: 'Debris disposal',
      bucket: 'disposal_fees',
      valueMin: 200,
      valueMax: 600,
    },
  ],
};

// ─── All built-in verticals ───────────────────────────────────────────────────
// Add future verticals here. Only roofing is fully configured.

export const ALL_VERTICALS: VerticalConfig[] = [ROOFING_VERTICAL];
