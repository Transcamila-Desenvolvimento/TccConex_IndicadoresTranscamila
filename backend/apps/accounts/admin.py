from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser, Role


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'description')
    search_fields = ('id', 'name')


@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'name', 'role_id', 'status', 'last_login')
    list_filter = ('role_id', 'status')
    fieldsets = UserAdmin.fieldsets + (
        ('Prothon', {'fields': ('name', 'role_id', 'status', 'environments', 'filiais')}),
    )
