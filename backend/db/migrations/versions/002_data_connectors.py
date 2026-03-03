"""Add data_connectors table

Revision ID: 002
Revises: 001
Create Date: 2026-03-02

Adds the data_connectors table for PostgreSQL and S3 connector credentials
(stored encrypted via Fernet).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── data_connectors ────────────────────────────────────────────────────────
    op.create_table(
        "data_connectors",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "org_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("name", sa.Text, nullable=False),
        # connector_type: "postgres" | "s3"
        sa.Column("connector_type", sa.Text, nullable=False),
        # Fernet-encrypted JSON blob containing connection credentials
        sa.Column("config_encrypted", sa.Text, nullable=False),
        sa.Column("last_tested_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_test_ok", sa.Boolean, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_data_connectors_org_id", "data_connectors", ["org_id"])
    op.create_index(
        "ix_data_connectors_created_by", "data_connectors", ["created_by"]
    )


def downgrade() -> None:
    op.drop_index("ix_data_connectors_created_by", table_name="data_connectors")
    op.drop_index("ix_data_connectors_org_id", table_name="data_connectors")
    op.drop_table("data_connectors")
