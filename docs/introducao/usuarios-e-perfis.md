# Usuários e perfis

Fonte: `backend/apps/accounts/models.py`.

## Papéis

`Role` guarda `id`, `name`, `description` e uma lista JSON `permissions`.

No usuário, `role_id` vale `'1'` para administrador e `'2'` para operador. `is_admin` e `is_operator` leem esse campo. O acesso ao ambiente Administração/Manutenção exige administrador (`user_has_module_access`).

## Estado da conta

`status` usa `'ativo'` ou `'inativo'`. Conta inativa não autentica no JWT. `must_change_password` manda o frontend para `/change-password` antes do restante do sistema.

## O que o administrador configura no usuário

| Campo | Efeito no código |
|---|---|
| `environments` | Ambientes que o operador pode abrir |
| `filiais` | Filiais por ambiente |
| `indicadores` | Abas de Indicadores. Lista vazia libera todas |
| `indicador_filiais` | Recorte de filial por indicador |
| `funcoes` | Funções extras do operador, por ambiente |
| `abas` | Abas de menu por ambiente. Vazio no módulo libera todas. A aba home entra quando há recorte |
| `aba_filiais` | Filiais de cada rotina |
| `funcao_filiais` | Filiais de cada função. Lista vazia vale para todas as filiais do ambiente |

Administrador ignora o recorte de funções (`has_funcao` devolve verdadeiro).
