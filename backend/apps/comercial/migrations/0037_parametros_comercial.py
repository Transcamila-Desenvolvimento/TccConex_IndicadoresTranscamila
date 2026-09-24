from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('comercial', '0036_proposta_revisao_inicial_vazia'),
    ]

    operations = [
        migrations.CreateModel(
            name='ParametrosComercial',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('logo_pdf', models.BinaryField(blank=True, null=True, verbose_name='Logo do PDF da proposta')),
                ('logo_pdf_tipo', models.CharField(blank=True, default='', max_length=40)),
                ('logo_email', models.BinaryField(blank=True, null=True, verbose_name='Logo do e-mail da proposta')),
                ('logo_email_tipo', models.CharField(blank=True, default='', max_length=40)),
                ('validades', models.JSONField(blank=True, default=list, verbose_name='Validades das propostas')),
                ('validade_padrao', models.CharField(blank=True, default='', max_length=80)),
                ('prazos_faturamento', models.JSONField(blank=True, default=list, verbose_name='Prazos de faturamento')),
                ('faturamento_padrao', models.CharField(blank=True, default='', max_length=120)),
                ('vigencias', models.JSONField(blank=True, default=list, verbose_name='Vigências do contrato')),
                ('vigencia_padrao', models.CharField(blank=True, default='', max_length=80)),
                ('atualizado_em', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Parâmetros do Comercial',
                'verbose_name_plural': 'Parâmetros do Comercial',
            },
        ),
    ]
