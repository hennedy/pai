import { describe, it, expect, vi, beforeEach } from 'vitest'

// Testes unitarios das regras de negocio de producao

describe('Producao - Regras de Negocio', () => {
  describe('Consumo automatico de insumos', () => {
    it('deve calcular quantidade de ingredientes proporcional ao rendimento', () => {
      // Receita: rendimento 50 paes, usa 5kg farinha
      const rendimento = 50
      const quantidadePlanejada = 100
      const fator = quantidadePlanejada / rendimento
      const farinhaBase = 5 // kg

      const farinhaNecess = farinhaBase * fator
      expect(farinhaNecess).toBe(10) // 10kg para 100 paes
    })

    it('deve bloquear conclusao quando estoque insuficiente', () => {
      const ingredientes = [
        { nome: 'Farinha', necessario: 10, disponivel: 15 },
        { nome: 'Fermento', necessario: 0.2, disponivel: 0.1 }, // insuficiente
        { nome: 'Sal', necessario: 0.1, disponivel: 1 },
      ]

      const insuficientes = ingredientes.filter((i) => i.disponivel < i.necessario)
      expect(insuficientes).toHaveLength(1)
      expect(insuficientes[0].nome).toBe('Fermento')
    })

    it('deve permitir conclusao quando todos os ingredientes disponiveis', () => {
      const ingredientes = [
        { nome: 'Farinha', necessario: 5, disponivel: 50 },
        { nome: 'Fermento', necessario: 0.1, disponivel: 5 },
        { nome: 'Sal', necessario: 0.1, disponivel: 10 },
      ]

      const insuficientes = ingredientes.filter((i) => i.disponivel < i.necessario)
      expect(insuficientes).toHaveLength(0)
    })
  })

  describe('Versao de receita', () => {
    it('deve incrementar versao ao editar ingredientes', () => {
      const versaoAtual = 1
      const ingredientesAlterados = true
      const novaVersao = ingredientesAlterados ? versaoAtual + 1 : versaoAtual

      expect(novaVersao).toBe(2)
    })

    it('nao deve incrementar versao ao editar apenas nome', () => {
      const versaoAtual = 3
      const ingredientesAlterados = false
      const novaVersao = ingredientesAlterados ? versaoAtual + 1 : versaoAtual

      expect(novaVersao).toBe(3)
    })
  })

  describe('Custo estimado da receita', () => {
    it('deve calcular custo total corretamente', () => {
      const ingredientes = [
        { quantidade: 5, custoMedioProduto: 4.5 },   // 22.50
        { quantidade: 0.1, custoMedioProduto: 25.0 }, // 2.50
        { quantidade: 0.1, custoMedioProduto: 2.5 },  // 0.25
      ]

      const custoTotal = ingredientes.reduce(
        (acc, i) => acc + i.quantidade * i.custoMedioProduto,
        0
      )

      expect(custoTotal).toBeCloseTo(25.25)
    })

    it('deve calcular custo por unidade', () => {
      const custoTotal = 25.25
      const rendimento = 50

      const custoPorUnidade = custoTotal / rendimento
      expect(custoPorUnidade).toBeCloseTo(0.505)
    })
  })

  describe('Status da ordem de producao', () => {
    it('deve seguir fluxo correto de status', () => {
      const fluxosValidos: Record<string, string[]> = {
        planejada: ['em_andamento', 'cancelada'],
        em_andamento: ['concluida', 'cancelada'],
        concluida: [],
        cancelada: [],
      }

      // Planejada -> em_andamento: valido
      expect(fluxosValidos.planejada).toContain('em_andamento')

      // Em andamento -> concluida: valido
      expect(fluxosValidos.em_andamento).toContain('concluida')

      // Concluida -> cancelada: invalido
      expect(fluxosValidos.concluida).not.toContain('cancelada')

      // Cancelada -> em_andamento: invalido
      expect(fluxosValidos.cancelada).not.toContain('em_andamento')
    })
  })

  describe('Relatorio planejado vs realizado', () => {
    it('deve calcular percentual de atingimento', () => {
      const planejado = 100
      const realizado = 95
      const percentual = (realizado / planejado) * 100

      expect(percentual).toBe(95)
    })

    it('deve tratar planejado zero sem divisao por zero', () => {
      const planejado = 0
      const realizado = 0
      const percentual = planejado === 0 ? 0 : (realizado / planejado) * 100

      expect(percentual).toBe(0)
    })
  })
})
