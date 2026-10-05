from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('camilo', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='ChatPadrao',
            fields=[
                ('id', models.PositiveSmallIntegerField(default=1, editable=False, primary_key=True, serialize=False)),
                ('nome', models.CharField(default='Camilo', max_length=80)),
                ('instrucao', models.TextField(blank=True, default='')),
            ],
            options={
                'verbose_name': 'Chat padrão CamiloIA',
                'verbose_name_plural': 'Chat padrão CamiloIA',
            },
        ),
    ]
