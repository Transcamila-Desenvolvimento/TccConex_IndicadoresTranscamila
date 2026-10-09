from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def criar_versao_inicial(apps, schema_editor):
    TermoVersao = apps.get_model('camilo', 'TermoVersao')
    if TermoVersao.objects.exists():
        return
    from apps.camilo.termo import TERMOS

    texto = TERMOS['v1']
    TermoVersao.objects.create(
        numero=1,
        titulo=texto['titulo'],
        introducao=texto['introducao'],
        assinatura=texto['assinatura'],
        declaracao=texto['declaracao'],
        secoes=texto['secoes'],
        vigente=True,
    )


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('camilo', '0004_termoaceite_cpf'),
    ]

    operations = [
        migrations.CreateModel(
            name='TermoVersao',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('numero', models.PositiveIntegerField(unique=True)),
                ('titulo', models.CharField(max_length=120)),
                ('introducao', models.TextField()),
                ('assinatura', models.CharField(max_length=240)),
                ('declaracao', models.CharField(max_length=240)),
                ('secoes', models.JSONField(default=list)),
                ('vigente', models.BooleanField(default=False)),
                ('criado_em', models.DateTimeField(auto_now_add=True)),
                ('criado_por', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='termos_camilo_publicados',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'Versão do termo CamiloIA',
                'verbose_name_plural': 'Versões do termo CamiloIA',
                'ordering': ['-numero'],
            },
        ),
        migrations.RunPython(criar_versao_inicial, migrations.RunPython.noop),
    ]
