package governance.decision

import rego.v1

# ==========================================
# PERFIL: Developer
# ==========================================

# Whitelist de Binários
is_permitted_binary if {
    user_has_role("Developer")
    input.context.binary in ["kubectl"]
}

# Regra Geral: Developer pode realizar ações de LEITURA apenas nos namespaces 'dev' e 'sandbox'.
is_allowed if {
    user_has_role("Developer")
    input.context.binary == "kubectl"
    input.context.namespace in ["dev", "sandbox"]
    is_read_only_action
}

# Regra Geral: Developer pode realizar ações de CRIAÇÃO/ESCRITA apenas nos namespaces 'dev' e 'sandbox'.
# Nota: "is_write_action" exclui ações perigosas como "delete" e "scale".
is_allowed if {
    user_has_role("Developer")
    input.context.binary == "kubectl"
    input.context.namespace in ["dev", "sandbox"]
    is_write_action
}

# Regra de Escala: Nos namespaces 'dev' e 'sandbox', Developer pode escalar até no máximo 3 réplicas.
is_allowed if {
    user_has_role("Developer")
    input.context.binary == "kubectl"
    input.context.namespace in ["dev", "sandbox"]
    input.context.action == "scale"
    requested_replicas <= 3
}

# O acesso a "prod" é completamente bloqueado de forma automática (Zero Trust), 
# pois não existe nenhuma regra nesta política que o autorize.
