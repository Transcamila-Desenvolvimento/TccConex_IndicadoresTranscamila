from datetime import datetime

from .models import BalanceHistoryEntry, BankAccount


def format_last_updated() -> str:
    now = datetime.now()
    return now.strftime('%d/%m/%Y %H:%M')


def refresh_account_balance(account_id: int) -> None:
    try:
        account = BankAccount.objects.get(pk=account_id)
    except BankAccount.DoesNotExist:
        return

    latest = (
        BalanceHistoryEntry.objects.filter(account_id=account_id)
        .order_by('-reference_date', '-id')
        .first()
    )
    if latest:
        account.balance = latest.value
        account.last_updated = format_last_updated()
    else:
        account.balance = 0
        account.last_updated = '--/--/----'
    account.save(update_fields=['balance', 'last_updated'])


def sync_account_metadata(account: BankAccount) -> None:
    BalanceHistoryEntry.objects.filter(account_id=account.pk).update(
        bank=account.bank,
        number=account.number,
        entry_type=account.account_type,
    )
