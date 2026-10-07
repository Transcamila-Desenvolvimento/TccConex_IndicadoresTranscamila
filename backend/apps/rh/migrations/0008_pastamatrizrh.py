from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('rh', '0007_documentorh_drive'),
    ]

    operations = [
        migrations.CreateModel(
            name='PastaMatrizRH',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nome', models.CharField(max_length=120, verbose_name='Nome')),
                ('criado_em', models.DateTimeField(auto_now_add=True)),
                ('parent', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='subpastas', to='rh.pastamatrizrh', verbose_name='Pasta superior')),
            ],
            options={
                'verbose_name': 'Pasta da matriz de conhecimento',
                'verbose_name_plural': 'Pastas da matriz de conhecimento',
                'ordering': ['nome', 'pk'],
            },
        ),
        migrations.AddField(
            model_name='documentorh',
            name='pasta',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='documentos', to='rh.pastamatrizrh', verbose_name='Pasta'),
        ),
    ]
