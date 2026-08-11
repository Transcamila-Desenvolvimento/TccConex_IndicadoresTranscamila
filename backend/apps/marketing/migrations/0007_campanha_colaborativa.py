from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('marketing', '0006_campanha_replace_instagram'),
    ]

    operations = [
        migrations.AddField(
            model_name='campanhamarketing',
            name='criado_por_user',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='campanhas_criadas',
                to=settings.AUTH_USER_MODEL,
                verbose_name='Criado por (usuário)',
            ),
        ),
        migrations.AddField(
            model_name='campanhamarketing',
            name='responsavel_user',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='campanhas_responsavel',
                to=settings.AUTH_USER_MODEL,
                verbose_name='Responsável (usuário)',
            ),
        ),
        migrations.CreateModel(
            name='CampanhaComentario',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('autor_nome', models.CharField(blank=True, default='', max_length=150)),
                ('texto', models.TextField(verbose_name='Comentário')),
                ('data_criacao', models.DateTimeField(auto_now_add=True)),
                ('autor_user', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='campanha_comentarios',
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='Autor',
                )),
                ('campanha', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='comentarios',
                    to='marketing.campanhamarketing',
                    verbose_name='Campanha',
                )),
            ],
            options={
                'verbose_name': 'Comentário de campanha',
                'verbose_name_plural': 'Comentários de campanha',
                'ordering': ['data_criacao'],
            },
        ),
    ]
