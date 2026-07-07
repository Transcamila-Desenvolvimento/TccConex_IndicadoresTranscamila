from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0003_rename_admin_environment'),
    ]

    operations = [
        migrations.AddField(
            model_name='customuser',
            name='google_email',
            field=models.EmailField(blank=True, max_length=254, null=True),
        ),
        migrations.AddField(
            model_name='customuser',
            name='google_sub',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name='customuser',
            name='google_linked_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
