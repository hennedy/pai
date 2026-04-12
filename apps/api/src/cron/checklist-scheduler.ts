import { prisma } from '@pai/database'

let intervalId: ReturnType<typeof setInterval> | null = null

/**
 * Retorna o numero da semana ISO do ano para uma data.
 * Usado para calcular "a cada N semanas".
 */
function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayOfWeek = d.getUTCDay() || 7 // Domingo = 7
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

/**
 * Verifica se uma data esta na lista de datas de excecao.
 */
function ehDataExcecao(datasExcecao: any, dataFormatada: string): boolean {
  if (!datasExcecao) return false
  const lista: string[] = Array.isArray(datasExcecao) ? datasExcecao : []
  return lista.includes(dataFormatada)
}

async function runChecklistGeneration() {
  try {
    console.log('🔄 [Checklist Scheduler] Verificando checklists agendados...')
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    const diaDaSemana = hoje.getDay() // 0 = Domingo, 1 = Segunda, ..., 6 = Sabado
    const diaDoMes = hoje.getDate()
    const mesAtual = hoje.getMonth() + 1 // 1 a 12
    const dataFormatada = hoje.toISOString().split('T')[0] // YYYY-MM-DD
    const semanaDoAno = getISOWeekNumber(hoje)

    const templates = await prisma.checklistTemplate.findMany({
      where: { status: 'ativo', isAdhoc: false },
    })

    const unidades = await prisma.unit.findMany({
      where: { status: 'ativo' },
    })

    let checklistsCriados = 0

    for (const template of templates) {
      // Verificar se hoje e data de excecao do template
      if (ehDataExcecao(template.datasExcecao, dataFormatada)) {
        console.log(`⏭ [Checklist Scheduler] Template "${template.nome}" ignorado — data de excecao do template.`)
        continue
      }

      let deveCriarHoje = false

      if (template.recorrencia) {
        const cfg: any = typeof template.recorrencia === 'string'
          ? JSON.parse(template.recorrencia)
          : template.recorrencia

        if (cfg) {
          switch (cfg.tipo) {
            case 'diario':
              deveCriarHoje = true
              break

            case 'semanal': {
              const intervalo: number = cfg.intervaloSemanas && cfg.intervaloSemanas > 1 ? cfg.intervaloSemanas : 1
              const semanaCorreta = intervalo <= 1 || (semanaDoAno % intervalo === 0)
              if (semanaCorreta && Array.isArray(cfg.diasSemana) && cfg.diasSemana.includes(diaDaSemana)) {
                deveCriarHoje = true
              }
              break
            }

            case 'mensal':
              if (Array.isArray(cfg.diasMes) && cfg.diasMes.includes(diaDoMes)) deveCriarHoje = true
              break

            case 'anual':
              if (cfg.mes === mesAtual && cfg.dia === diaDoMes) deveCriarHoje = true
              break

            case 'data_especifica':
              if (Array.isArray(cfg.datas) && cfg.datas.includes(dataFormatada)) deveCriarHoje = true
              break

            default:
              // Retrocompatibilidade
              if (Array.isArray(cfg.diasSemana) && cfg.diasSemana.includes(diaDaSemana)) deveCriarHoje = true
              break
          }
        }
      } else {
        // Retrocompatibilidade: obrigatorio sem regras = diario
        if (template.obrigatorio) deveCriarHoje = true
      }

      if (deveCriarHoje) {
        const unitsToApply = template.unitId ? [template.unitId] : unidades.map(u => u.id)

        for (const uId of unitsToApply) {
          // Verificar se a unidade tem excecao para hoje
          const unidade = unidades.find(u => u.id === uId)
          if (unidade && ehDataExcecao((unidade as any).datasExcecao, dataFormatada)) {
            console.log(`⏭ [Checklist Scheduler] Unidade "${unidade.nome}" ignorada — data de excecao da unidade.`)
            continue
          }

          const existe = await prisma.checklistExecution.findFirst({
            where: {
              templateId: template.id,
              unitId: uId,
              data: hoje,
            }
          })

          if (!existe) {
            const prazoLimite = new Date(hoje)
            prazoLimite.setHours(23, 59, 59)

            await prisma.checklistExecution.create({
              data: {
                templateId: template.id,
                unitId: uId,
                turno: ['manha', 'tarde', 'noite'].includes(template.horario) ? template.horario as any : 'manha',
                data: hoje,
                prazoLimite,
                atribuidoAId: template.atribuidoAId || null,
                status: 'pendente'
              }
            })
            checklistsCriados++
          }
        }
      }
    }

    console.log(`✅ [Checklist Scheduler] Verificacao terminada. ${checklistsCriados} checklists despachados.`)
  } catch (error) {
    console.error('❌ [Checklist Scheduler] Erro ao processar:', error)
  }
}

export function initChecklistScheduler() {
  runChecklistGeneration()
  intervalId = setInterval(runChecklistGeneration, 60 * 60 * 1000)
  console.log('🔄 [Checklist Scheduler] Worker iniciado com intervalo manual (1 hr)')
}
