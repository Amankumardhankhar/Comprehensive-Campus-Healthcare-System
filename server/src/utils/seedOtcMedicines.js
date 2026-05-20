import { Medicine } from '../models/Medicine.js';
import { logger } from './logger.js';

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

const DEFAULT_OTC_MEDICINES = [
  {
    name: 'Paracetamol 500mg',
    genericName: 'paracetamol',
    category: 'antipyretic',
    unit: 'tablet',
    pricePerUnit: 2,
    minStockLevel: 50,
    maxPerSession: 4,
    indications: ['fever', 'headache', 'mild pain', 'body ache'],
    contraindications: ['severe liver disease'],
  },
  {
    name: 'Ibuprofen 200mg',
    genericName: 'ibuprofen',
    category: 'analgesic',
    unit: 'tablet',
    pricePerUnit: 3,
    minStockLevel: 50,
    maxPerSession: 4,
    indications: ['mild pain', 'headache', 'menstrual cramps'],
    contraindications: ['peptic ulcer', 'pregnancy'],
  },
  {
    name: 'Cetirizine 10mg',
    genericName: 'cetirizine',
    category: 'antihistamine',
    unit: 'tablet',
    pricePerUnit: 2,
    minStockLevel: 40,
    maxPerSession: 2,
    indications: ['allergy', 'runny nose', 'sneezing', 'itching', 'rash'],
    contraindications: [],
  },
  {
    name: 'Antacid Gel 200ml',
    genericName: 'aluminium-magnesium hydroxide',
    category: 'antacid',
    unit: 'bottle',
    pricePerUnit: 45,
    minStockLevel: 20,
    maxPerSession: 1,
    indications: ['acidity', 'heartburn', 'indigestion'],
    contraindications: [],
  },
  {
    name: 'ORS Sachet',
    genericName: 'oral rehydration salts',
    category: 'other',
    unit: 'unit',
    pricePerUnit: 10,
    minStockLevel: 30,
    maxPerSession: 4,
    indications: ['dehydration', 'diarrhea', 'vomiting'],
    contraindications: [],
  },
  {
    name: 'Cough Syrup 100ml',
    genericName: 'dextromethorphan',
    category: 'cough_cold',
    unit: 'bottle',
    pricePerUnit: 60,
    minStockLevel: 20,
    maxPerSession: 1,
    indications: ['cough', 'sore throat'],
    contraindications: [],
  },
  {
    name: 'Vitamin C 500mg',
    genericName: 'ascorbic acid',
    category: 'vitamin',
    unit: 'tablet',
    pricePerUnit: 4,
    minStockLevel: 40,
    maxPerSession: 2,
    indications: ['cold', 'immunity'],
    contraindications: [],
  },
  {
    name: 'Adhesive Bandage',
    genericName: 'bandage',
    category: 'first_aid',
    unit: 'unit',
    pricePerUnit: 5,
    minStockLevel: 50,
    maxPerSession: 4,
    indications: ['minor cut', 'abrasion'],
    contraindications: [],
  },
];

export const seedOtcMedicines = async () => {
  const expiry = new Date(Date.now() + ONE_YEAR_MS);
  let created = 0;
  let updated = 0;

  for (const med of DEFAULT_OTC_MEDICINES) {
    const existing = await Medicine.findOne({
      genericName: med.genericName,
      name: med.name,
    });

    if (existing) {
      existing.otcSafe = true;
      existing.dispensableByMachine = true;
      existing.maxPerSession = existing.maxPerSession || med.maxPerSession;
      existing.indications = existing.indications?.length ? existing.indications : med.indications;
      existing.contraindications = existing.contraindications?.length
        ? existing.contraindications
        : med.contraindications;
      if (!existing.pricePerUnit) existing.pricePerUnit = med.pricePerUnit;
      await existing.save();
      updated += 1;
    } else {
      await Medicine.create({
        ...med,
        otcSafe: true,
        dispensableByMachine: true,
        quantity: 100,
        expiryDate: expiry,
        isActive: true,
      });
      created += 1;
    }
  }

  logger.info(`OTC seed complete: ${created} created, ${updated} updated`);
};
