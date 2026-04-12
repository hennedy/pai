# PAI Print Agent

Agente local de impressão — roda na máquina do balcão e faz a ponte entre o browser e a impressora térmica via TCP.

## Por que é necessário?

A API do PAI está hospedada na nuvem e não consegue alcançar endereços de rede local (192.168.0.x).
Este agente roda **localmente** e tem acesso direto à impressora.

```
Browser → API (nuvem) → retorna buffer ESC/POS base64
Browser → Print Agent (localhost:3456) → TCP → Impressora (ex: 192.168.0.173:9100)
```

## Requisitos

- Node.js 18 ou superior
- Mesma rede local da impressora térmica

## Instalação e uso

```bash
# Na pasta do agente:
node index.js

# Ou com porta customizada:
PORT=3456 node index.js
```

O agente inicia em `http://127.0.0.1:3456` e fica aguardando jobs de impressão.

## Rodar automaticamente no Windows (opcional)

Crie uma tarefa no Agendador de Tarefas do Windows para iniciar o agente no login:

1. Abra o **Agendador de Tarefas**
2. Criar Tarefa Básica → nome: "PAI Print Agent"
3. Gatilho: Ao fazer logon
4. Ação: Iniciar programa
   - Programa: `node`
   - Argumentos: `C:\caminho\para\print-agent\index.js`
5. Marcar "Executar com privilégios mais altos" se necessário

## Variáveis de ambiente

| Variável         | Padrão               | Descrição                          |
|------------------|----------------------|------------------------------------|
| `PORT`           | `3456`               | Porta HTTP do agente               |
| `ALLOWED_ORIGIN` | `*`                  | Origin CORS permitida              |

## Endpoints

| Método | Path      | Descrição                                 |
|--------|-----------|-------------------------------------------|
| GET    | /health   | Verifica se o agente está rodando         |
| POST   | /print    | Recebe `{ ip, port, buffer }` e imprime   |
