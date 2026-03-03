"""Add is_starred and archived_at to datasets

Revision ID: 003
Revises: 002
"""
from alembic import op
import sqlalchemy as sa

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "datasets",
        sa.Column("is_starred", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "datasets",
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_datasets_is_starred", "datasets", ["is_starred"])
    op.create_index("ix_datasets_archived_at", "datasets", ["archived_at"])


def downgrade() -> None:
    op.drop_index("ix_datasets_archived_at", table_name="datasets")
    op.drop_index("ix_datasets_is_starred", table_name="datasets")
    op.drop_column("datasets", "archived_at")
    op.drop_column("datasets", "is_starred")
