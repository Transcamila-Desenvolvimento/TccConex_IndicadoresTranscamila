from django.contrib.auth.models import AbstractUser
from django.db import models


class Role(models.Model):
    id = models.CharField(max_length=10, primary_key=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    permissions = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return self.name


class CustomUser(AbstractUser):
    # Full name representation
    name = models.CharField(max_length=255, blank=True)
    
    # roleId: '1' = Admin, '2' = Operador
    role_id = models.CharField(max_length=10, default='2')
    
    # status: 'ativo' | 'inativo'
    status = models.CharField(max_length=15, default='ativo')
    
    # JSON arrays/objects for dynamic permissions configuration
    # Example: ["Financeiro", "Indicadores"]
    environments = models.JSONField(default=list, blank=True)
    
    # Example: {"Indicadores": ["Ibiporã (Matriz)", "Rondonópolis"], "Financeiro": ["Paranaguá"]}
    filiais = models.JSONField(default=dict, blank=True)

    # Indicadores/abas liberados no ambiente Indicadores (chaves de
    # constants.INDICADORES_KEYS). Lista vazia = acesso a todos.
    indicadores = models.JSONField(default=list, blank=True)

    # Funções extras liberadas por ambiente para operadores.
    # Example: {"Faturamento": ["excluir-protocolos", "gerenciar-clientes"]}
    funcoes = models.JSONField(default=dict, blank=True)

    google_email = models.EmailField(blank=True, null=True)
    google_sub = models.CharField(max_length=255, blank=True, null=True)
    google_linked_at = models.DateTimeField(blank=True, null=True)
    google_token = models.JSONField(blank=True, null=True)

    # Admin solicita; usuário deve trocar a senha no próximo acesso.
    must_change_password = models.BooleanField(default=False)

    def __str__(self):
        return self.username

    @property
    def is_admin(self):
        return self.role_id == '1'

    @property
    def is_operator(self):
        return self.role_id == '2'

    @property
    def is_currently_active(self):
        return self.status == 'ativo'

    def has_funcao(self, module: str, funcao: str) -> bool:
        """Admin tem todas as funções; operador só as liberadas em `funcoes`."""
        if self.is_admin:
            return True
        return funcao in (self.funcoes or {}).get(module, [])
