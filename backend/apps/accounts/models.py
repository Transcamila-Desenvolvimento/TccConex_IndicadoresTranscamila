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

    google_email = models.EmailField(blank=True, null=True)
    google_sub = models.CharField(max_length=255, blank=True, null=True)
    google_linked_at = models.DateTimeField(blank=True, null=True)
    google_token = models.JSONField(blank=True, null=True)

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
