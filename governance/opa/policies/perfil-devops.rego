package governance.decision

import rego.v1

# ==========================================
# PERFIL: DevOps
# ==========================================

# Whitelist de Binários
is_permitted_binary if {
    user_has_role("DevOps")
    input.context.binary in ["kubectl", "terraform", "helm"]
}

# Regra: DevOps pode realizar ações de LEITURA nos namespaces explicitados abaixo.
is_allowed if {
    user_has_role("DevOps")
    input.context.binary == "kubectl"
    input.context.namespace in ["dev", "staging", "prod", "sandbox", "default", "kube-system"]
    is_read_only_action
}

# Regra: DevOps pode realizar ações de CRIAÇÃO/ESCRITA nos namespaces explicitados abaixo.
# Nota: "is_write_action" (apply, create, patch, edit) já EXCLUI comandos como "delete" e "scale".
is_allowed if {
    user_has_role("DevOps")
    input.context.binary == "kubectl"
    input.context.namespace in ["dev", "staging", "prod", "sandbox", "default", "kube-system"]
    is_write_action
}

# Regra de Deleção: DevOps possui autorização para DELETAR recursos nos namespaces explicitados abaixo.
is_allowed if {
    user_has_role("DevOps")
    input.context.binary == "kubectl"
    input.context.namespace in ["dev", "staging", "prod", "sandbox", "default", "kube-system"]
    input.context.action == "delete"
}

# Regra de Escala: DevOps pode realizar operações de scale nos namespaces explicitados, MAS limitado a no máximo 5 réplicas.
is_allowed if {
    user_has_role("DevOps")
    input.context.binary == "kubectl"
    input.context.namespace in ["dev", "staging", "prod", "sandbox", "default", "kube-system"]
    input.context.action == "scale"
    requested_replicas <= 5
}

# Regra: DevOps tem passe livre para usar comandos do Helm.
is_allowed if {
    user_has_role("DevOps")
    input.context.binary == "helm"
}

# Regra: DevOps tem passe livre para usar comandos do Terraform.
is_allowed if {
    user_has_role("DevOps")
    input.context.binary == "terraform"
}
