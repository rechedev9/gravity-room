import { z } from 'zod';

export const ExerciseReferenceSchema = z
  .object({
    doi: z.string().min(1).optional(),
    pmid: z.string().regex(/^\d+$/).optional(),
    title: z.string().min(1),
    authors: z.string().min(1),
    year: z.number().int().min(1900).max(2100),
    url: z.string().url(),
  })
  .refine((r) => r.doi !== undefined || r.pmid !== undefined, {
    message: 'reference must include a doi or pmid',
  });

export const LocalizedArticleSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1).max(200),
  summary: z.array(z.string().min(1)).min(1),
  technique: z.array(z.string().min(1)).min(1),
  evidence: z
    .array(
      z.object({
        claim: z.string().min(1),
        refIndices: z.array(z.number().int().min(0)).min(1),
      })
    )
    .min(1),
  commonMistakes: z.array(z.string().min(1)).min(1),
  variations: z.array(z.object({ name: z.string().min(1), detail: z.string().min(1) })).optional(),
});

export const ExerciseArticleSchema = z.object({
  exerciseId: z.string().min(1),
  slug: z.object({ es: z.string().min(1), en: z.string().min(1) }),
  muscleGroupId: z.string().min(1),
  equipment: z.string().min(1).nullable(),
  level: z.enum(['beginner', 'intermediate', 'advanced']),
  primaryMuscles: z.array(z.string().min(1)).min(1),
  secondaryMuscles: z.array(z.string().min(1)),
  video: z
    .object({
      youtubeId: z.string().min(1),
      title: z.string().min(1),
      channel: z.string().min(1),
      uploadDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      duration: z.string().regex(/^PT/),
    })
    .optional(),
  references: z.array(ExerciseReferenceSchema).min(1),
  content: z.object({ es: LocalizedArticleSchema, en: LocalizedArticleSchema }),
  reviewedBy: z.string().min(1),
  reviewedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type ExerciseReference = z.infer<typeof ExerciseReferenceSchema>;
export type LocalizedArticle = z.infer<typeof LocalizedArticleSchema>;
export type ExerciseArticle = z.infer<typeof ExerciseArticleSchema>;
export type ArticleLang = 'es' | 'en';
