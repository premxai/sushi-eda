"""Add personal dashboard saves and report object-storage pointers.

Revision ID: 101_dashboard_saves
Revises: 100_baseline
"""

from alembic import op
import sqlalchemy as sa

revision = "101_dashboard_saves"
down_revision = "100_baseline"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("analyses", sa.Column("report_key", sa.Text(), nullable=True))
    op.create_table(
        "dashboard_saves",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("dataset_id", sa.Uuid(), sa.ForeignKey("datasets.id", ondelete="CASCADE"), nullable=True),
        sa.Column("analysis_id", sa.Uuid(), sa.ForeignKey("analyses.id", ondelete="CASCADE"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.UniqueConstraint("user_id", "dataset_id", "kind", name="uq_dashboard_saves_dataset"),
        sa.UniqueConstraint("user_id", "analysis_id", "kind", name="uq_dashboard_saves_analysis"),
    )
    op.create_index("ix_dashboard_saves_user_kind", "dashboard_saves", ["user_id", "kind"])


def downgrade() -> None:
    op.drop_index("ix_dashboard_saves_user_kind", table_name="dashboard_saves")
    op.drop_table("dashboard_saves")
    op.drop_column("analyses", "report_key")
