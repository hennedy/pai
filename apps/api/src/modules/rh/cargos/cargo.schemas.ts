import { z } from 'zod'

export const createFamiliaSchema = z.object({
  nome: z.string().min(1).max(100),
  descricao: z.string().max(500).optional(),
})

export const updateFamiliaSchema = createFamiliaSchema.partial()

export const familiaIdParamSchema = z.object({
  id: z.string().uuid(),
})

export const createCargoSchema = z.object({
  nome: z.string().min(1).max(100),
  familiaId: z.string().uuid().optional(),
  codigo: z.string().max(20).optional(),
  nivel: z.enum(['junior', 'pleno', 'senior', 'especialista', 'coordenador', 'gerente', 'diretor']).default('junior'),
  descricao: z.string().max(1000).optional(),
  responsabilidades: z.string().optional(),
  requisitos: z.string().optional(),
  cargaHorariaSemanal: z.number().int().min(1).max(60).default(44),
})

export const updateCargoSchema = createCargoSchema.partial()

export const cargoIdParamSchema = z.object({
  id: z.string().uuid(),
})

export const cargoStatusSchema = z.object({
  status: z.enum(['ativo', 'inativo']),
})

export const listCargosQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  familiaId: z.string().uuid().optional(),
  nivel: z.enum(['junior', 'pleno', 'senior', 'especialista', 'coordenador', 'gerente', 'diretor']).optional(),
  status: z.enum(['ativo', 'inativo']).optional(),
})

export const createFaixaSchema = z.object({
  nivel: z.enum(['junior', 'pleno', 'senior', 'especialista', 'coordenador', 'gerente', 'diretor']),
  salarioMinimo: z.number().min(0),
  salarioMedio: z.number().min(0),
  salarioMaximo: z.number().min(0),
  vigenteDe: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).transform(v => new Date(v)),
  vigenteAte: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).transform(v => new Date(v)).optional(),
})

export const faixaIdParamSchema = z.object({
  id: z.string().uuid(),
  faixaId: z.string().uuid(),
})
