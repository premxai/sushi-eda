"""Add ETL pipeline builder tables

Revision ID: 004
Revises: 003
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "pipeline_recipes",
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
        sa.Column(
            "source_dataset_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("datasets.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("graph", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("destination_type", sa.Text(), nullable=False, server_default="dataset"),
        sa.Column("destination_config", postgresql.JSONB(), nullable=True),
        sa.Column("schedule", sa.Text(), nullable=False, server_default="0 * * * *"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_run_status", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_pipeline_recipes_org_id", "pipeline_recipes", ["org_id"])
    op.create_index("ix_pipeline_recipes_source_dataset_id", "pipeline_recipes", ["source_dataset_id"])

    op.create_table(
        "pipeline_recipe_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "pipeline_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("pipeline_recipes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("graph", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint(
            "pipeline_id",
            "version",
            name="uq_pipeline_recipe_versions_pipeline_version",
        ),
    )
    op.create_index(
        "ix_pipeline_recipe_versions_pipeline_id",
        "pipeline_recipe_versions",
        ["pipeline_id"],
    )

    op.create_table(
        "pipeline_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "pipeline_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("pipeline_recipes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "org_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "triggered_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
        sa.Column("recipe_version", sa.Integer(), nullable=False),
        sa.Column("trigger_type", sa.Text(), nullable=False, server_default="manual"),
        sa.Column("status", sa.Text(), nullable=False, server_default="pending"),
        sa.Column("logs", sa.Text(), nullable=True),
        sa.Column("metrics", postgresql.JSONB(), nullable=True),
        sa.Column(
            "output_dataset_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("datasets.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_pipeline_runs_org_id", "pipeline_runs", ["org_id"])
    op.create_index("ix_pipeline_runs_pipeline_id", "pipeline_runs", ["pipeline_id"])
    op.create_index("ix_pipeline_runs_started_at", "pipeline_runs", ["started_at"])


def downgrade() -> None:
    op.drop_index("ix_pipeline_runs_started_at", table_name="pipeline_runs")
    op.drop_index("ix_pipeline_runs_pipeline_id", table_name="pipeline_runs")
    op.drop_index("ix_pipeline_runs_org_id", table_name="pipeline_runs")
    op.drop_table("pipeline_runs")

    op.drop_index("ix_pipeline_recipe_versions_pipeline_id", table_name="pipeline_recipe_versions")
    op.drop_table("pipeline_recipe_versions")

    op.drop_index("ix_pipeline_recipes_source_dataset_id", table_name="pipeline_recipes")
    op.drop_index("ix_pipeline_recipes_org_id", table_name="pipeline_recipes")
    op.drop_table("pipeline_recipes")
