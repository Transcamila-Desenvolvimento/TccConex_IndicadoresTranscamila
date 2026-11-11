from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('rh', '0013_funcionarioquadro_departamento'),
        ('frota', '0013_remove_custos_e_cadastros'),
    ]

    operations = [
        migrations.CreateModel(
            name='UsuarioMotorista',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('username', models.CharField(max_length=80, unique=True, verbose_name='Usuário')),
                ('password', models.CharField(max_length=128, verbose_name='Senha')),
                ('criado_em', models.DateTimeField(auto_now_add=True)),
                ('criado_por', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='usuarios_motorista_criados', to=settings.AUTH_USER_MODEL)),
                ('funcionario', models.OneToOneField(on_delete=django.db.models.deletion.PROTECT, related_name='usuario_motorista', to='rh.funcionarioquadro', verbose_name='Funcionário')),
            ],
            options={
                'verbose_name': 'Usuário motorista',
                'verbose_name_plural': 'Usuários motoristas',
                'ordering': ['funcionario__nome'],
            },
        ),
    ]
