import { z } from 'zod'

export const createColaboradorSchema = z.object({
  nome: z.string().min(1).max(150),
  primeiroNome: z.string().max(50).optional(),
  userId: z.string().uuid().optional(),
  unitId: z.string().uuid(),
  cargoId: z.string().uuid().optional(),
  gestorDiretoId: z.string().uuid().optional(),
  departamento: z.string().max(100).optional(),
  nomeSocial: z.string().max(150).optional(),
  dataNascimento: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).transform(v => new Date(v)).optional(),
  genero: z.enum(['masculino', 'feminino', 'outro', 'prefiro_nao_informar']).optional(),
  estadoCivil: z.enum(['solteiro', 'casado', 'divorciado', 'viuvo', 'uniao_estavel', 'outro']).optional(),
  nacionalidade: z.string().max(50).optional(),
  naturalidade: z.string().max(100).optional(),
  cpf: z.string().regex(/^\d{11}$/, 'CPF deve ter 11 digitos numericos').optional(),
  rg: z.string().max(20).optional(),
  rgOrgao: z.string().max(20).optional(),
  rgDataEmissao: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).transform(v => new Date(v)).optional(),
  ctpsNumero: z.string().max(20).optional(),
  ctpsSerie: z.string().max(10).optional(),
  ctpsUF: z.string().length(2).optional(),
  pisNit: z.string().max(20).optional(),
  cnhNumero: z.string().max(20).optional(),
  cnhCategoria: z.string().max(5).optional(),
  cnhValidade: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).transform(v => new Date(v)).optional(),
  tituloEleitor: z.string().max(20).optional(),
  reservista: z.string().max(20).optional(),
  email: z.string().email().optional(),
  emailCorporativo: z.string().email().optional(),
  telefone: z.string().max(20).optional(),
  celular: z.string().max(20).optional(),
  tipoContrato: z.enum(['clt', 'pj', 'estagio', 'aprendiz', 'temporario', 'autonomo']).default('clt'),
  dataAdmissao: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).transform(v => new Date(v)).optional(),
  salarioBase: z.number().min(0).optional(),
  cargaHorariaSemanal: z.number().int().min(1).max(60).default(44),
  observacoes: z.string().max(1000).optional(),
})

export const updateColaboradorSchema = createColaboradorSchema.partial().omit({ unitId: true, tipoContrato: true })

export const colaboradorIdParamSchema = z.object({
  id: z.string().uuid(),
})

export const colaboradorStatusSchema = z.object({
  status: z.enum(['ativo', 'inativo', 'ferias', 'afastado', 'desligado']),
  motivo: z.string().optional(),
})

export const listColaboradoresQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  unitId: z.string().uuid().optional(),
  cargoId: z.string().uuid().optional(),
  departamento: z.string().optional(),
  tipoContrato: z.enum(['clt', 'pj', 'estagio', 'aprendiz', 'temporario', 'autonomo']).optional(),
  status: z.enum(['ativo', 'inativo', 'ferias', 'afastado', 'desligado']).optional(),
})

export const enderecoSchema = z.object({
  cep: z.string().max(10).optional(),
  logradouro: z.string().max(200).optional(),
  numero: z.string().max(20).optional(),
  complemento: z.string().max(100).optional(),
  bairro: z.string().max(100).optional(),
  cidade: z.string().max(100).optional(),
  uf: z.string().length(2).optional(),
})

export const contatoEmergenciaSchema = z.object({
  nome: z.string().min(1).max(150),
  parentesco: z.string().min(1).max(50),
  telefone: z.string().min(1).max(20),
  celular: z.string().max(20).optional(),
})

export const dependenteSchema = z.object({
  nome: z.string().min(1).max(150),
  parentesco: z.string().min(1).max(50),
  dataNascimento: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).transform(v => new Date(v)).optional(),
  cpf: z.string().regex(/^\d{11}$/).optional(),
})

export const formacaoSchema = z.object({
  nivel: z.enum(['fundamental', 'medio', 'tecnico', 'graduacao', 'pos', 'mestrado', 'doutorado']),
  curso: z.string().max(150).optional(),
  instituicao: z.string().max(150).optional(),
  anoConclusao: z.number().int().min(1950).max(2100).optional(),
  status: z.enum(['completo', 'incompleto', 'em_andamento']).default('completo'),
})

export const historicoSalarioSchema = z.object({
  salarioNovo: z.number().min(0),
  motivo: z.enum(['admissao', 'promocao', 'reajuste', 'acordo_coletivo', 'correcao']).optional(),
  dataEfetivo: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).transform(v => new Date(v)),
})

export const historicoCargSchema = z.object({
  cargoNovoId: z.string().uuid(),
  motivo: z.string().max(200).optional(),
  dataEfetivo: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).transform(v => new Date(v)),
})

export const vincularUsuarioSchema = z.object({
  userId: z.string().uuid().nullable(),
})

export const subIdParamSchema = z.object({
  id: z.string().uuid(),
  subId: z.string().uuid(),
})
