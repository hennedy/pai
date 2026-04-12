import { z } from 'zod'

export const criarAdmissaoSchema = z.object({
  colaboradorId: z.string().uuid(),
  emailEnviado: z.string().email().optional(),
  dataExpiracao: z.string().datetime().optional(),
  observacoes: z.string().optional(),
})

export const enviarAdmissaoSchema = z.object({
  emailEnviado: z.string().email(),
  dataExpiracao: z.string().datetime().optional(),
})

export const preencherAdmissaoSchema = z.object({
  // dados pessoais
  nomeSocial: z.string().optional(),
  dataNascimento: z.string().optional(),
  genero: z.enum(['masculino', 'feminino', 'outro', 'prefiro_nao_informar']).optional(),
  estadoCivil: z.enum(['solteiro', 'casado', 'divorciado', 'viuvo', 'uniao_estavel', 'outro']).optional(),
  nacionalidade: z.string().optional(),
  naturalidade: z.string().optional(),
  // documentos
  cpf: z.string().optional(),
  rg: z.string().optional(),
  rgOrgao: z.string().optional(),
  rgDataEmissao: z.string().optional(),
  ctpsNumero: z.string().optional(),
  ctpsSerie: z.string().optional(),
  ctpsUF: z.string().optional(),
  pisNit: z.string().optional(),
  cnhNumero: z.string().optional(),
  cnhCategoria: z.string().optional(),
  cnhValidade: z.string().optional(),
  tituloEleitor: z.string().optional(),
  reservista: z.string().optional(),
  // contato
  email: z.string().email().optional(),
  telefone: z.string().optional(),
  celular: z.string().optional(),
  // endereco
  cep: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  uf: z.string().optional(),
  // dados bancarios (armazenados em dadosPreenchidos como JSON)
  banco: z.string().optional(),
  agencia: z.string().optional(),
  conta: z.string().optional(),
  tipoConta: z.enum(['corrente', 'poupanca']).optional(),
  // dependentes
  dependentes: z.array(z.object({
    nome: z.string(),
    parentesco: z.string(),
    dataNascimento: z.string().optional(),
    cpf: z.string().optional(),
  })).optional(),
  // formacao
  formacoes: z.array(z.object({
    nivel: z.string(),
    curso: z.string().optional(),
    instituicao: z.string().optional(),
    anoConclusao: z.number().optional(),
    status: z.string().optional(),
  })).optional(),
})

export const aprovarAdmissaoSchema = z.object({
  observacoes: z.string().optional(),
})

export const rejeitarAdmissaoSchema = z.object({
  observacoes: z.string().min(1, 'Informe o motivo da rejeição'),
})

export const admissaoIdParamSchema = z.object({
  id: z.string().uuid(),
})

export const admissaoTokenParamSchema = z.object({
  token: z.string().uuid(),
})

export const listAdmissoesQuerySchema = z.object({
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20),
  status: z.enum(['rascunho', 'enviado', 'em_preenchimento', 'aguardando_aprovacao', 'aprovado', 'rejeitado', 'expirado']).optional(),
  search: z.string().optional(),
})

export type CriarAdmissaoInput = z.infer<typeof criarAdmissaoSchema>
export type PreencherAdmissaoInput = z.infer<typeof preencherAdmissaoSchema>
export type ListAdmissoesQuery = z.infer<typeof listAdmissoesQuerySchema>
