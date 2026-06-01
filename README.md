# Auto Ward: IA Segura 🛡️


### 1. O Risco da IA Autônoma (IA como Agente)
A evolução da Inteligência Artificial nos trouxe à era dos Agentes Autônomos. Demos ferramentas, terminais e autonomia para que as IAs resolvam problemas complexos sozinhas. Mas isso traz uma pergunta aterrorizante para qualquer engenheiro de infraestrutura: 

**E se a IA apagar o banco de dados?** 💥🗑️

### 2. Conheça o Auto Ward: O Guarda-costas da IA
Para resolver esse problema, criamos o **Auto Ward**. Ele atua como um verdadeiro "guarda-costas" entre o Agente de IA e a sua infraestrutura crítica. 
Implementando uma arquitetura rigorosa de **Zero Trust** (Confiança Zero) e **Policy-as-Code** (Políticas como Código), o Auto Ward garante que a IA seja produtiva, mas completamente incapaz de destruir o seu ambiente.

### ⚡ Avaliação Rápida (O Fluxo de Decisão)
Antes de qualquer comando da IA encostar no seu servidor ou cluster Kubernetes, o Auto Ward intercepta e realiza uma avaliação rápida em três etapas:

1. **Identidade:** *Quem é a IA?* (Autenticação JWT via Keycloak)
2. **Intenção:** *O que ela deseja fazer?* (Parsing do comando via MCP)
3. **Regras:** *É permitido?* (Julgamento instantâneo via Open Policy Agent)

---
![Auto Ward Architecture](./docs/architecture.png)
## 🧩 Os Componentes (Quem é Quem?)

Para garantir que um Agente de IA não faça besteira no seu cluster, dividimos a responsabilidade em 4 camadas:

### 1. 🧠 O Agente (Layer 1 - Intenção)
É o "cérebro" (ex: OpenClaw, LLM, n8n). Ele tem a necessidade técnica (ex: "preciso de mais réplicas para aguentar o tráfego"), mas **não tem credenciais** da infraestrutura. Ele apenas gera uma **Intenção**.

### 2. ⚡ O Braço (Layer 2 - Execution Layer)
Diretório: `02-execution-layer/`.
Implementado em **NestJS** com protocolo **MCP (Model Context Protocol)**. Ele é o único que fala com o Kubernetes. Ele recebe a intenção do agente, mas não executa nada sem antes consultar os "auditores".

### 3. 🛂 Keycloak (Layer 3 - O Passaporte)
Nosso sistema de **IAM (Identity and Access Management)**. Ele garante que sabemos EXATAMENTE quem é o agente. Ele fornece os "crachás" (Tokens JWT) que dizem qual a Role do agente (DevOps, Developer, etc).

### 4. ⚖️ OPA - Open Policy Agent (Layer 3 - O Juiz)
É o motor de **Policy-as-Code**. Ele detém as regras de negócio escritas em linguagem **Rego**. O Proxy pergunta ao OPA: *"O agente X (Developer) quer escalar o app Y no namespace 'prod'. Pode?"*. O OPA julga e responde `true` ou `false`.

### 5. 🏗️ Kubernetes/k3d (Layer 4 - O Alvo)
A infraestrutura final que será controlada. Ela está isolada e só aceita comandos vindo do Proxy validado.

---

## 🔄 O Fluxo de Segurança
1.  **Agente** se autentica no **Keycloak** e ganha um Token.
2.  **Agente** envia uma chamada **MCP** para o **Proxy** com o Token.
3.  **Proxy** valida o Token localmente (Identidade).
4.  **Proxy** registra a **Intenção** no Banco de Auditoria com decisão inicial `DENY`.
5.  **Proxy** envia o Token e o contexto para o **OPA**.
6.  **OPA** decodifica o JWT, avalia as regras e dá o veredito.
7.  Se **Permitido**, o **Proxy** atualiza o log para `ALLOW`, executa no **K8s** e loga o resultado.
8.  Se **Negado**, o **Proxy** atualiza o log para `BLOCKED` e retorna `403 Forbidden`.

---

## 🚀 Guia de Setup

### 1. Pré-requisitos
- Docker e Docker Compose
- Rede Docker `wolf_network` criada:
  ```bash
  docker network create wolf_network
  ```

### 2. Subir o Ambiente
```bash
docker compose up -d --build
```

### 3. Mapa de Portas (Host Local)

| Serviço | URL | Acesso Admin |
| :--- | :--- | :--- |
| **Proxy (NestJS)** | `http://localhost:3000` | - |
| **MCP SSE** | `http://localhost:3000/mcp/sse` | - |
| **Keycloak** | `http://localhost:8085` | `admin / admin` |
| **OPA API** | `http://localhost:8185` | - |
| **Audit DB (PostgreSQL)** | `localhost:5435` | `postgres / postgres` |

### 4. Binários Disponíveis no Container

A imagem da Execution Layer (`node:20-alpine`) instala apenas o `kubectl`. Outros binários como `helm` e `terraform` são reconhecidos pelo parser e pelas regras OPA, mas **precisam ser adicionados ao Dockerfile** para funcionar.

| Binário | Instalado? | Regras OPA |
| :--- | :---: | :--- |
| `kubectl` | ✅ | DevOps: full (exceto delete/scale em prod), Developer: read-only em dev |
| `helm` | ❌ | DevOps: passe livre |
| `terraform` | ❌ | DevOps: passe livre |

---

## 📡 Referência de API (Endpoints)

### Autenticação — Keycloak

Todos os endpoints que executam comandos requerem um **JWT Token** do Keycloak. O token pode ser enviado no corpo da requisição (campo `agent_token`) ou via header `Authorization: Bearer <token>`.

#### Obter Token

```bash
# Realm: secure-agents | Client: execution-layer

# --- Usuário DevOps (Role: DevOps) ---
TOKEN=$(curl -s -X POST "http://localhost:8085/realms/secure-agents/protocol/openid-connect/token" \
  -d "grant_type=password" \
  -d "client_id=execution-layer" \
  -d "client_secret=very-secret-key-123" \
  -d "username=agent-devops" \
  -d "password=password123" | jq -r .access_token)

# --- Usuário Developer (Role: Developer) ---
TOKEN=$(curl -s -X POST "http://localhost:8085/realms/secure-agents/protocol/openid-connect/token" \
  -d "grant_type=password" \
  -d "client_id=execution-layer" \
  -d "client_secret=very-secret-key-123" \
  -d "username=agent-dev" \
  -d "password=password123" | jq -r .access_token)
```

**Usuários pré-configurados:**

| Username | Password | Role | Poderes |
| :--- | :--- | :--- | :--- |
| `agent-devops` | `password123` | `DevOps` | kubectl/helm/terraform, limite 3 réplicas em prod |
| `agent-dev` | `password123` | `Developer` | Leitura em dev, sandbox livre, limite 5 réplicas |

---

### `GET /` — Health Check

Verificação rápida de que a Execution Layer está rodando.

```bash
curl http://localhost:3000/
```

**Response:**
```
Hello World!
```

---

### `POST /mcp/call` ou `POST /mcp` — Chamada Direta de Tool (HTTP)

Este é o endpoint principal para **chamadas diretas** (sem SSE). Ideal para testes, scripts e integrações simples.

**URL:** `POST http://localhost:3000/mcp/call` ou `POST http://localhost:3000/mcp`

#### Tool: `execute_shell_command`

Executa qualquer comando shell disponível no container, sujeito à validação do OPA.

**Request Body:**
```json
{
  "name": "execute_shell_command",
  "arguments": {
    "command": "<comando shell completo>",
    "agent_token": "<JWT Token>"
  }
}
```

**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :---: | :--- |
| `name` | string | ✅ | Nome da tool: `execute_shell_command` |
| `arguments.command` | string | ✅ | Comando shell completo (ex: `kubectl get pods -n dev`) |
| `arguments.agent_token` | string | ✅ | JWT Token obtido do Keycloak |

**Exemplo — Listar pods (DevOps):**
```bash
curl -X POST http://localhost:3000/mcp/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "execute_shell_command",
    "arguments": {
      "command": "kubectl get pods -n dev",
      "agent_token": "'$TOKEN'"
    }
  }'
```

**Response (Success — 200):**
```json
{
  "content": [
    { "type": "text", "text": "Command output:\nNAME         READY   STATUS    RESTARTS   AGE\ndev-app-1    1/1     Running   0          2h\n" },
    { "type": "text", "text": "Command error (if any):\n" }
  ]
}
```

**Response (Denied — 403):**
```json
{
  "statusCode": 403,
  "message": "Access Denied: Acesso negado por política Zero Trust (Regra padrão)",
  "error": "Forbidden"
}
```

**Exemplo — Descrever deployment (Developer em dev):**
```bash
curl -X POST http://localhost:3000/mcp/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "execute_shell_command",
    "arguments": {
      "command": "kubectl describe deployment dev-app -n dev",
      "agent_token": "'$TOKEN'"
    }
  }'
```

**Exemplo — Ver logs (Developer em dev):**
```bash
curl -X POST http://localhost:3000/mcp/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "execute_shell_command",
    "arguments": {
      "command": "kubectl logs deployment/dev-app -n dev --tail=50",
      "agent_token": "'$TOKEN'"
    }
  }'
```



### MCP via SSE (Server-Sent Events) — Protocolo Nativo

Para **clientes MCP nativos** (LLMs, IDEs, agentes MCP-compatíveis), a Execution Layer expõe o protocolo MCP sobre SSE.

#### `GET /mcp/sse` — Conectar via SSE

Abre uma conexão SSE persistente e retorna um `sessionId` para envio de mensagens.

```bash
# Conectar (fica aberto como stream)
curl -N http://localhost:3000/mcp/sse
```

O servidor envia um evento SSE com o endpoint de mensagens:
```
event: endpoint
data: /mcp/messages?sessionId=<session-id>
```

#### `POST /mcp/messages?sessionId=<id>` — Enviar Mensagem JSON-RPC

Envia uma mensagem JSON-RPC 2.0 para a sessão MCP ativa.

**Listar Tools Disponíveis:**
```bash
curl -X POST "http://localhost:3000/mcp/messages?sessionId=<SESSION_ID>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {}
  }'
```

**Chamar uma Tool:**
```bash
curl -X POST "http://localhost:3000/mcp/messages?sessionId=<SESSION_ID>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "execute_shell_command",
      "arguments": {
        "command": "kubectl get namespaces",
        "agent_token": "'$TOKEN'"
      }
    }
  }'
```

> **Nota:** A resposta é entregue via stream SSE na conexão `GET /mcp/sse`, não no body do POST (que retorna `200 OK`).

---

### `GET /audit` — Logs de Auditoria

Retorna todos os registros de auditoria ordenados por timestamp decrescente.

```bash
curl http://localhost:3000/audit | jq
```

**Response (200):**
```json
[
  {
    "id": "a1b2c3d4-...",
    "timestamp": "2026-05-20T21:55:00.000Z",
    "agentId": "agent-devops",
    "action": "execute_shell_command",
    "intent": {
      "command": "kubectl get pods -n dev",
      "binary": "kubectl",
      "action": "get",
      "resource": "pods",
      "namespace": "dev"
    },
    "decision": "ALLOW",
    "reason": "Acesso autorizado (Perfil DevOps)",
    "ruleId": "devops-ok",
    "context": {
      "binary": "kubectl",
      "action": "get",
      "resource": "pods",
      "namespace": "dev"
    },
    "executionStatus": "SUCCESS",
    "executionResult": "{\"stdout\":\"NAME ...\",\"stderr\":\"\"}"
  }
]
```

**Campos do Audit Log:**

| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | UUID | Identificador único do log |
| `timestamp` | DateTime | Momento do registro |
| `agentId` | string | Username extraído do JWT (`preferred_username`) |
| `action` | string | Nome da tool chamada |
| `intent` | JSON | Comando e metadados parseados |
| `decision` | `ALLOW` \| `DENY` | Decisão final do OPA |
| `reason` | string | Mensagem de auditoria do OPA |
| `ruleId` | string | Identificador da regra ativada |
| `context` | JSON | Contexto enviado ao OPA |
| `executionStatus` | string | `SUCCESS`, `FAILED`, ou `BLOCKED` |
| `executionResult` | string | Output do comando (stdout/stderr) |

---

### OPA — Consulta Direta de Políticas

O OPA é acessível diretamente para testes e debugging de regras.

**Testar uma decisão diretamente no OPA:**
```bash
curl -X POST http://localhost:8185/v1/data/governance/decision \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "action": "execute_shell_command",
      "user": {
        "preferred_username": "agent-devops",
        "realm_access": { "roles": ["DevOps"] }
      },
      "context": {
        "binary": "kubectl",
        "action": "get",
        "resource": "pods",
        "namespace": "dev"
      }
    }
  }' | jq
```

**Response:**
```json
{
  "result": {
    "decision": {
      "allow": true,
      "reason": "Acesso autorizado (Perfil DevOps)",
      "rule_id": "devops-ok"
    }
  }
}
```

**Testar Scale do Developer (Verificando Limite de 5):**
```bash
curl -s -X POST http://localhost:8185/v1/data/governance/decision \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "action": "execute_shell_command",
      "user": {
        "preferred_username": "agent-dev",
        "realm_access": { "roles": ["Developer"] }
      },
      "context": {
        "binary": "kubectl",
        "action": "scale",
        "resource": "deployment",
        "namespace": "dev",
        "replicas": 3
      }
    }
  }' | jq
```

**Response:**
```json
{
  "result": {
    "decision": {
      "allow": true,
      "reason": "Acesso autorizado (Perfil Developer)",
      "rule_id": "dev-agent-dev-ok"
    }
  }
}
```

---

## 🧪 Roteiro de Testes (Flows)

Utilize o script unificado `./scripts/auto-ward-test.sh` para validar os fluxos de governança:

### 🟢 Fluxo 1: Permissão (ALLOW)
**Cenário**: Um agente DevOps lista pods em ambiente de dev.
```bash
# 1. Obter token do DevOps
TOKEN=$(curl -s -X POST "http://localhost:8085/realms/secure-agents/protocol/openid-connect/token" \
  -d "grant_type=password" \
  -d "client_id=execution-layer" \
  -d "client_secret=very-secret-key-123" \
  -d "username=agent-devops" \
  -d "password=password123" | jq -r .access_token)

# 2. Executar comando permitido
curl -s -X POST http://localhost:3000/mcp/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "execute_shell_command",
    "arguments": {
      "command": "kubectl get pods -n dev",
      "agent_token": "'$TOKEN'"
    }
  }' | jq
```
- **Regra Ativada**: `devops-ok`
- **Resultado Esperado**: `200 OK` com output do kubectl

### 🔴 Fluxo 2: Negação (DENY)
**Cenário**: Um agente DevOps tenta escalar em PROD acima do limite de segurança (> 3 réplicas).
```bash
# 1. Obter token do DevOps
TOKEN=$(curl -s -X POST "http://localhost:8085/realms/secure-agents/protocol/openid-connect/token" \
  -d "grant_type=password" \
  -d "client_id=execution-layer" \
  -d "client_secret=very-secret-key-123" \
  -d "username=agent-devops" \
  -d "password=password123" | jq -r .access_token)

# 2. Tentar escalar acima do limite
curl -s -X POST http://localhost:3000/mcp/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "execute_shell_command",
    "arguments": {
      "command": "kubectl scale deployment critical-app -n prod --replicas=6",
      "agent_token": "'$TOKEN'"
    }
  }' | jq
```
- **Regra Ativada**: `devops-agent-prod-limit`
- **Resultado Esperado**:
  - `HTTP 403 Forbidden`
  - Resposta: `"Access Denied: Limite de segurança excedido em PROD (Máximo: 3)"`

### 🟡 Fluxo 3: Developer no Sandbox (ALLOW)
**Cenário**: Developer tem liberdade total no namespace `sandbox`.
```bash
# 1. Obter token do Developer
TOKEN=$(curl -s -X POST "http://localhost:8085/realms/secure-agents/protocol/openid-connect/token" \
  -d "grant_type=password" \
  -d "client_id=execution-layer" \
  -d "client_secret=very-secret-key-123" \
  -d "username=agent-dev" \
  -d "password=password123" | jq -r .access_token)

# 2. Executar comando no sandbox (permitido)
curl -s -X POST http://localhost:3000/mcp/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "execute_shell_command",
    "arguments": {
      "command": "kubectl get all -n sandbox",
      "agent_token": "'$TOKEN'"
    }
  }' | jq
```

### 🔴 Fluxo 4: Developer Bloqueado em Prod
**Cenário**: Developer tenta acessar namespace `prod`.
```bash
curl -s -X POST http://localhost:3000/mcp/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "execute_shell_command",
    "arguments": {
      "command": "kubectl get pods -n prod",
      "agent_token": "'$TOKEN'"
    }
  }' | jq
```
- **Resultado Esperado**: `HTTP 403 Forbidden` — Zero Trust default deny

### 📋 Verificar Audit Trail
```bash
# Todos os logs
curl -s http://localhost:3000/audit | jq

# Filtrar apenas negações (client-side)
curl -s http://localhost:3000/audit | jq '[.[] | select(.decision == "DENY")]'
```

---

## 🔐 Gestão de Políticas (Rego v1)

As regras de governança são escritas em **Rego** e estão divididas de forma modular dentro do diretório `03-governance/opa/policies/` (`global.rego`, `perfil-devops.rego`, etc).

### Hierarquia de Agentes

| Perfil | Namespace | Permissões | Limite de Scale |
| :--- | :--- | :--- | :--- |
| **DevOps** | `dev`, `staging` | kubectl, helm, terraform (full) | - |
| **DevOps** | `prod` | kubectl (exceto delete), helm, terraform | Máximo **3** réplicas |
| **DevOps** | `sandbox` | Liberdade total | - |
| **Developer** | `dev` | Apenas leitura (`get`, `describe`, `logs`) | Máximo **5** réplicas |
| **Developer** | `sandbox` | Liberdade total | Máximo **5** réplicas |
| **Developer** | `prod` | ❌ Bloqueado | - |

O sistema utiliza **Attribute-Based Access Control (ABAC)**, cruzando dados do token JWT (Keycloak) com o contexto da requisição (JSON Intent).

### Como o Command Parser Funciona

O `CommandParser` extrai metadados do comando textual para alimentar o OPA:

```
kubectl get pods -n dev
  │       │    │      │
  │       │    │      └─ namespace: "dev"
  │       │    └─ resource: "pods"
  │       └─ action: "get"
  └─ binary: "kubectl"
```

Esses metadados são enviados ao OPA como `input.context`:
```json
{
  "binary": "kubectl",
  "action": "get",
  "resource": "pods",
  "namespace": "dev",
  "args": ["get", "pods", "-n", "dev"]
}
```

---

## 🏗️ Estrutura do Projeto

```
openclaw-ward/
├── 01-agent/                  # Camada do Agente (intenção)
├── 02-execution-layer/        # NestJS Execution Proxy
│   ├── src/
│   │   ├── main.ts            # Bootstrap (porta 3000)
│   │   ├── app.module.ts      # Root module (TypeORM, ConfigModule)
│   │   └── modules/
│   │       ├── mcp/           # MCP Controller + Service (SSE + HTTP)
│   │       ├── execution/     # ShellExecutor + CommandParser + K8s client
│   │       ├── policy/        # PolicyService (OPA client)
│   │       ├── audit/         # AuditService + AuditLog Entity (TypeORM/PostgreSQL)
│   │       └── auth/          # AuthGuard (JWT decode)
│   └── Dockerfile             # node:20-alpine + kubectl
├── 03-governance/
│   ├── keycloak/
│   │   └── realm-export.json  # Realm "secure-agents" (users, roles, client)
│   ├── opa/
│   │   └── policies/
│   │       └── governance.rego # Regras Rego v1 (ABAC)
│   └── postgres/
│       └── init-db.sh         # Cria databases: audit_db + keycloak_db
├── 04-target-infra/           # Manifests K8s/k3d
├── scripts/                   # Scripts de teste e validação
├── docker-compose.yml         # Orquestração (4 serviços + wolf_network)
└── README.md
```

---

## 📚 Referências e Documentação

Para aprofundar o conhecimento nos componentes utilizados nesta arquitetura:

- **[NestJS](https://docs.nestjs.com/)**: Framework Node.js progressivo para construção de aplicativos do lado do servidor.
- **[Open Policy Agent (OPA)](https://www.openpolicyagent.org/docs/latest/)**: Motor de políticas de propósito geral focado em unificar a aplicação de políticas.
- **[Keycloak](https://www.keycloak.org/documentation)**: Solução de código aberto para gerenciamento de identidade e acesso (IAM).
- **[Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction)**: Protocolo aberto para integração segura entre LLMs e ferramentas.
- **[Kubernetes API](https://kubernetes.io/docs/concepts/overview/kubernetes-api/)**: Documentação oficial da API do Kubernetes.
- **[Rego Language](https://www.openpolicyagent.org/docs/latest/policy-language/)**: Referência da linguagem de consulta utilizada para as políticas do OPA.
