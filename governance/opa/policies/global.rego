package governance.decision

import rego.v1

# --- POLÍTICA DE DECISÃO (ENTRYPOINT) ---
# Aqui definimos a regra padrão (Zero Trust).
default allow := false


# Transforma a avaliação do `is_allowed` em um boolean puro, garantindo que o binário é válido e o shell é seguro.
# IMPORTANTE: `is_allowed` será alimentado pelos outros arquivos (perfil-devops.rego, etc).
is_allowed_eval := true if { 
    is_allowed
    is_permitted_binary
    is_safe_shell
}
else := false

# O Objeto `decision` é a resposta final entregue ao Proxy (NestJS).
decision := {
    "allow": is_allowed_eval,
    "reason": reason,
    "rule_id": rule_id
}

# --- MENSAGENS DE AUDITORIA E LOGS ---
# As regras de mensagens dinâmicas consolidadas.

reason := "Comando bloqueado: tentativas de shell injection ou redirecionamento (|, &&, ||, ;, >) são proibidas" if {
    not is_safe_shell
}
else := "Binário não autorizado para o seu perfil de usuário" if {
    not is_permitted_binary
}
else := "Limite de segurança global excedido para DevOps (Máximo: 5)" if {
    user_has_role("DevOps")
    input.context.action == "scale"
    requested_replicas > 5
}
else := "Limite de segurança excedido para Developer (Máximo: 3)" if {
    user_has_role("Developer")
    input.context.namespace in ["dev", "sandbox"]
    input.context.action == "scale"
    requested_replicas > 3
}
else := "Acesso autorizado (Perfil DevOps)" if { is_allowed; user_has_role("DevOps") }
else := "Acesso autorizado (Perfil Developer)" if { is_allowed; user_has_role("Developer") }
else := "Access Denied: Acesso negado por política Zero Trust (Regra padrão)"

rule_id := "global-shell-injection-blocked" if {
    not is_safe_shell
}
else := "global-binary-blocked" if {
    not is_permitted_binary
}
else := "devops-agent-scale-limit" if {
    user_has_role("DevOps")
    input.context.action == "scale"
    requested_replicas > 5
}
else := "dev-agent-scale-limit" if {
    user_has_role("Developer")
    input.context.namespace in ["dev", "sandbox"]
    input.context.action == "scale"
    requested_replicas > 3
}
else := "devops-ok" if { is_allowed; user_has_role("DevOps") }
else := "dev-agent-dev-ok" if { is_allowed; user_has_role("Developer") }
else := "default-deny"

# --- HELPERS GERAIS (Funções Utilitárias) ---

# Extrai o número de réplicas do contexto JSON (caso exista).
requested_replicas := replicas if {
    replicas := to_number(input.context.replicas)
} else := 0

# Função: Verifica se o usuário autenticado possui a Role específica.
user_has_role(role) if {
    input.user.realm_access.roles[_] == role
}

# Define quais ações do kubectl são consideradas apenas leitura (inofensivas).
is_read_only_action if {
    input.context.action in ["get", "describe", "logs"]
}

# Define quais ações do kubectl alteram estado (escrita/criação), excluindo scale e delete.
is_write_action if {
    input.context.action in ["apply", "create", "patch", "edit"]
}

# Verifica se o comando contém operadores de encadeamento de shell perigosos.
# A avaliação falha (false) se encontrar pipes, cadeias lógicas, pontos e vírgulas ou redirecionamentos de saída.
is_safe_shell := false if { contains(input.context.raw_command, "|") }
else := false if { contains(input.context.raw_command, "&&") }
else := false if { contains(input.context.raw_command, "||") }
else := false if { contains(input.context.raw_command, ";") }
else := false if { contains(input.context.raw_command, ">") }
else := true
