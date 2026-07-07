from django.contrib import admin

from .models import AgingTitulo, PagarTitulo, ReceberTitulo, ReportBatch

admin.site.register(ReportBatch)
admin.site.register(PagarTitulo)
admin.site.register(ReceberTitulo)
admin.site.register(AgingTitulo)
