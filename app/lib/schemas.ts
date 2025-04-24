// app/lib/schemas.ts
import { z } from 'zod';

// Schema for Login
export const LoginSchema = z.object({
  badgeId: z.string().trim().min(1, { message: "Badge ID cannot be empty." }),
  password: z.string().min(1, { message: "Password cannot be empty." }),
});

// Schema for User Creation
export const CreateUserSchema = z.object({
  badgeId: z.string().trim().min(1, { message: "Badge ID cannot be empty." }),
  name: z.string().trim().min(1, { message: "Name cannot be empty." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters long." }),
});

// Schema for Incident Creation
export const IncidentCreateSchema = z.object({
  // Use z.coerce.date() to handle conversion from string input
  occurredAt: z.coerce.date({
      required_error: "Occurred At date is required.",
      invalid_type_error: "Invalid date/time format provided.",
  }),
  location: z.string().trim().min(1, { message: "Location cannot be empty." }),
  crimeType: z.string().trim().min(1, { message: "Crime Type cannot be empty." }),
  description: z.string().trim().min(1, { message: "Description cannot be empty." }),
  status: z.enum(['Open', 'Under Investigation', 'Closed']).default('Open'),
  // reportedById is added programmatically from context/token, not part of this form schema
  closingReason: z.string().trim().optional().nullable(),
});

// Schema for Incident Update (PATCH) - similar to create but fields are optional
export const IncidentUpdateSchema = z.object({
  // Use z.coerce.date() here as well
  occurredAt: z.coerce.date({
      invalid_type_error: "Invalid date/time format provided.",
  }).optional(),
  location: z.string().trim().min(1, { message: "Location cannot be empty." }).optional(),
  crimeType: z.string().trim().min(1, { message: "Crime Type cannot be empty." }).optional(),
  description: z.string().trim().min(1, { message: "Description cannot be empty." }).optional(),
  status: z.enum(['Open', 'Under Investigation', 'Closed']).optional(),
  closingReason: z.string().trim().nullable().optional(),
}).refine(data => Object.keys(data).length > 0, { // Ensure at least one field is provided for update
    message: "Please provide at least one field to update.",
    // path: ["_error"], // Assign error to a general form path if needed
});

// Define TypeScript types inferred from schemas for use in components
export type LoginFormData = z.infer<typeof LoginSchema>;
export type CreateUserFormData = z.infer<typeof CreateUserSchema>;
// Note: The inferred type for occurredAt will now be Date, not string
export type IncidentFormData = z.infer<typeof IncidentCreateSchema>;
export type IncidentUpdateFormData = z.infer<typeof IncidentUpdateSchema>;

// Schema for Evidence Creation
export const EvidenceCreateSchema = z.object({
    description: z.string().trim().min(1, { message: "Description cannot be empty." }),
    type: z.enum(['Photo', 'Document', 'Physical Item', 'Statement', 'Video', 'Audio', 'Other'], { required_error: "Evidence type is required.", invalid_type_error: "Invalid evidence type selected.", }),
    storageReference: z.string().trim().min(1, { message: "Storage reference cannot be empty." })
});
export type EvidenceCreateFormData = z.infer<typeof EvidenceCreateSchema>;

