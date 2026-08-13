from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('marketing', '0011_remove_campanha_atividade'),
    ]

    operations = [
        migrations.CreateModel(
            name='CampanhaMidia',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('drive_file_id', models.CharField(db_index=True, max_length=128, verbose_name='ID no Drive')),
                ('ordem', models.PositiveIntegerField(default=0, verbose_name='Ordem')),
                ('data_criacao', models.DateTimeField(auto_now_add=True)),
                ('adicionado_por', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='campanha_midias_adicionadas',
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='Adicionado por',
                )),
                ('campanha', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='midias',
                    to='marketing.campanhamarketing',
                    verbose_name='Campanha',
                )),
            ],
            options={
                'verbose_name': 'Arquivo da campanha',
                'verbose_name_plural': 'Arquivos da campanha',
                'ordering': ['ordem', 'data_criacao'],
            },
        ),
        migrations.AddConstraint(
            model_name='campanhamidia',
            constraint=models.UniqueConstraint(fields=('campanha', 'drive_file_id'), name='uniq_campanha_midia'),
        ),
    ]
