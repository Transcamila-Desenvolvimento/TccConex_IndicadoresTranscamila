from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('frota', '0008_frota_por_filial'),
    ]

    operations = [
        migrations.CreateModel(
            name='RespostaOlhoVivo',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('filial', models.CharField(choices=[('Ibiporã (Matriz)', 'Ibiporã (Matriz)'), ('Rondonópolis', 'Rondonópolis')], max_length=80, verbose_name='Filial')),
                ('periodicidade', models.CharField(choices=[('mensal', 'Mensal'), ('anual', 'Anual')], max_length=10)),
                ('ano', models.PositiveSmallIntegerField()),
                ('mes', models.PositiveSmallIntegerField(blank=True, null=True)),
                ('period_key', models.CharField(max_length=7)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('updated_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='respostas_olho_vivo', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Resposta Olho vivo na estrada',
                'verbose_name_plural': 'Respostas Olho vivo na estrada',
                'ordering': ['-ano', '-mes'],
                'unique_together': {('filial', 'period_key')},
            },
        ),
        migrations.CreateModel(
            name='ItemRespostaOlhoVivo',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('comportamento', models.CharField(max_length=40)),
                ('recorrencia', models.PositiveIntegerField(default=0)),
                ('resposta', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='itens', to='frota.respostaolhovivo')),
            ],
            options={
                'ordering': ['comportamento'],
                'unique_together': {('resposta', 'comportamento')},
            },
        ),
    ]
