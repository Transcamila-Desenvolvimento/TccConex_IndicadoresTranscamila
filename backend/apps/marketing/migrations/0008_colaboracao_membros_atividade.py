# Generated manually — colaboração: membros, atividades, menções

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('marketing', '0007_campanha_colaborativa'),
    ]

    operations = [
        migrations.CreateModel(
            name='CampanhaMembro',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('data_criacao', models.DateTimeField(auto_now_add=True)),
                ('adicionado_por', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='campanhas_membros_adicionados', to=settings.AUTH_USER_MODEL, verbose_name='Adicionado por')),
                ('campanha', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='membros', to='marketing.campanhamarketing', verbose_name='Campanha')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='campanhas_participando', to=settings.AUTH_USER_MODEL, verbose_name='Usuário')),
            ],
            options={
                'verbose_name': 'Membro da campanha',
                'verbose_name_plural': 'Membros da campanha',
                'ordering': ['data_criacao'],
            },
        ),
        migrations.CreateModel(
            name='CampanhaAtividade',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('tipo', models.CharField(choices=[('criada', 'Campanha criada'), ('comentario', 'Comentário'), ('status', 'Status alterado'), ('responsavel', 'Responsável alterado'), ('membro_adicionado', 'Membro adicionado'), ('membro_removido', 'Membro removido')], max_length=30, verbose_name='Tipo')),
                ('autor_nome', models.CharField(blank=True, default='', max_length=150)),
                ('descricao', models.TextField(verbose_name='Descrição')),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('data_criacao', models.DateTimeField(auto_now_add=True)),
                ('autor_user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='campanha_atividades', to=settings.AUTH_USER_MODEL, verbose_name='Autor')),
                ('campanha', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='atividades', to='marketing.campanhamarketing', verbose_name='Campanha')),
            ],
            options={
                'verbose_name': 'Atividade da campanha',
                'verbose_name_plural': 'Atividades da campanha',
                'ordering': ['-data_criacao'],
            },
        ),
        migrations.AddField(
            model_name='campanhacomentario',
            name='mencoes',
            field=models.ManyToManyField(blank=True, related_name='campanha_comentario_mencoes', to=settings.AUTH_USER_MODEL, verbose_name='Menções'),
        ),
        migrations.AddConstraint(
            model_name='campanhamembro',
            constraint=models.UniqueConstraint(fields=('campanha', 'user'), name='uniq_campanha_membro'),
        ),
    ]
