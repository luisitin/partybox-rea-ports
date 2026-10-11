// Authored asset identities and the host's generated, inspectable catalog (ADR-079).
import { z } from 'zod';

export const assetIdSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const assetFormSchema = z.enum([
  'master',
  'tv',
  'phone',
  'portrait',
  'chip',
  'card',
  'boardCrop',
  'thumb',
  'baseColor',
  'normal',
  'roughness',
  'metalness',
  'occlusion',
  'emissive',
]);
export type AssetForm = z.infer<typeof assetFormSchema>;
const filename = z
  .string()
  .regex(/^[a-z0-9][a-z0-9._-]*$/)
  .refine((name) => !name.includes('..'), 'Files are basenames inside this asset, never paths.');
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const lod = z.strictObject({
  triangles: z.number().int().positive().optional(),
  error: z.number().min(0).max(0.02).optional(),
});
const metadata = {
  id: assetIdSchema,
  title: z.string().min(1),
  kind: z.enum(['model', 'texture', 'material', 'image', 'card', 'portrait', 'scene']),
  status: z.enum(['approved', 'draft', 'placeholder']),
  realSizeMm: z
    .tuple([z.number().positive(), z.number().positive(), z.number().positive()])
    .optional(),
  source: z.strictObject({
    from: z.string(),
    author: z.string(),
    license: z.string(),
    url: z.union([z.literal(''), z.url()]),
  }),
  replaces: z.array(z.string()).default([]),
  notes: z.string().default(''),
  references: z.array(assetIdSchema).default([]),
  duplicateReason: z.string().min(1).optional(),
};
export const assetSchema = z.strictObject({
  ...metadata,
  files: z
    .partialRecord(assetFormSchema, filename)
    .refine((files) => Boolean(files.master), 'Every asset needs its authoritative master form.'),
  // Pin an authored rendition to its master, so replacing a master cannot leave an old face.
  overrides: z
    .partialRecord(
      assetFormSchema,
      z.strictObject({
        reason: z.string().min(1),
        masterHash: hash,
      }),
    )
    .default({}),
  generation: z
    .strictObject({
      tv: lod.optional(),
      phone: lod.optional(),
      thumbSource: assetFormSchema.optional(),
    })
    .default({}),
});
export type AssetDefinition = z.infer<typeof assetSchema>;

export const assetFileSchema = z.strictObject({
  file: filename,
  hash,
  bytes: z.number().int().nonnegative(),
  gzipBytes: z.number().int().nonnegative(),
  triangles: z.number().int().nonnegative().optional(),
  mime: z.string(),
  inputHash: hash.optional(),
});
export type AssetFile = z.infer<typeof assetFileSchema>;
export const assetManifestEntrySchema = z.strictObject({
  ...metadata,
  files: z.partialRecord(assetFormSchema, assetFileSchema),
  usedBy: z.array(
    z.strictObject({
      path: z.string(),
      line: z.number().int().positive(),
      kind: z.enum(['game', 'station', 'edition', 'film', 'room', 'code', 'asset']),
    }),
  ),
});
export const assetManifestSchema = z.strictObject({
  version: z.literal(1),
  assets: z.record(assetIdSchema, assetManifestEntrySchema),
});
export type AssetManifest = z.infer<typeof assetManifestSchema>;
