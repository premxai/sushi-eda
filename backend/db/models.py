"""
SQLAlchemy ORM models for the Sushi multi-tenant SaaS platform.

Tables
------
organizations   — tenants (each customer account)
users           — individual user accounts (linked to Clerk)
org_members     — user <-> org membership with role
datasets        — uploaded files / connected data sources
analyses        — versioned EDA results per dataset
monitors        — user-defined data quality checks
monitor_runs    — historical run results for each monitor
pipeline_recipes — ETL pipeline definitions
pipeline_recipe_versions — immutable snapshots of recipe versions
pipeline_runs   — run history and logs for pipeline executions
audit_logs      — immutable log of every user action
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    Text,
    TypeDecorator,
    Uuid,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB as PG_JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, backref, mapped_column, relationship
from sqlalchemy.sql import func


class _CoercingUuid(TypeDecorator):
    """Uuid that also accepts string values in queries.

    Postgres/asyncpg coerces UUID strings natively, but SQLite's Uuid bind
    processor requires uuid.UUID objects — and the routers pass string ids
    throughout. Coercing here keeps both backends working.
    """

    impl = Uuid
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if isinstance(value, str):
            return uuid.UUID(value)
        return value


UUID = _CoercingUuid
JSONB = JSON().with_variant(PG_JSONB, "postgresql")


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


class Base(DeclarativeBase):
    pass


# ─── Organizations ────────────────────────────────────────────────────────────


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=_uuid
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    slug: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    plan: Mapped[str] = mapped_column(
        Text, nullable=False, default="free"
    )  # free | pro | team | enterprise
    stripe_customer_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    stripe_subscription_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_credits_used: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    ai_credits_limit: Mapped[int] = mapped_column(
        Integer, nullable=False, default=10
    )  # free tier
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    members: Mapped[list["OrgMember"]] = relationship(
        "OrgMember", back_populates="org", cascade="all, delete-orphan"
    )
    datasets: Mapped[list["Dataset"]] = relationship(
        "Dataset", back_populates="org", cascade="all, delete-orphan"
    )
    monitors: Mapped[list["Monitor"]] = relationship(
        "Monitor", back_populates="org", cascade="all, delete-orphan"
    )
    connectors: Mapped[list["DataConnector"]] = relationship(
        "DataConnector", back_populates="org", cascade="all, delete-orphan"
    )
    pipelines: Mapped[list["PipelineRecipe"]] = relationship(
        "PipelineRecipe", back_populates="org", cascade="all, delete-orphan"
    )
    pipeline_runs: Mapped[list["PipelineRun"]] = relationship(
        "PipelineRun", back_populates="org", cascade="all, delete-orphan"
    )
    audit_logs: Mapped[list["AuditLog"]] = relationship(
        "AuditLog", back_populates="org", cascade="all, delete-orphan"
    )
    comments: Mapped[list["DatasetComment"]] = relationship(
        "DatasetComment", back_populates="org", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Organization {self.slug} plan={self.plan}>"


# ─── Users ────────────────────────────────────────────────────────────────────


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=_uuid
    )
    clerk_id: Mapped[str] = mapped_column(
        Text, unique=True, nullable=False
    )  # Clerk user ID
    email: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str | None] = mapped_column(Text, nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    memberships: Mapped[list["OrgMember"]] = relationship(
        "OrgMember", back_populates="user", cascade="all, delete-orphan"
    )
    datasets: Mapped[list["Dataset"]] = relationship(
        "Dataset", back_populates="created_by_user"
    )
    monitors: Mapped[list["Monitor"]] = relationship(
        "Monitor", back_populates="created_by_user"
    )
    pipelines: Mapped[list["PipelineRecipe"]] = relationship(
        "PipelineRecipe", back_populates="created_by_user"
    )

    def __repr__(self) -> str:
        return f"<User {self.email}>"


# ─── Org Memberships ──────────────────────────────────────────────────────────


class OrgMember(Base):
    __tablename__ = "org_members"
    __table_args__ = (
        UniqueConstraint("org_id", "user_id", name="uq_org_members_org_user"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=_uuid
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(
        Text, nullable=False, default="viewer"
    )  # admin | editor | viewer
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    org: Mapped["Organization"] = relationship("Organization", back_populates="members")
    user: Mapped["User"] = relationship("User", back_populates="memberships")

    def __repr__(self) -> str:
        return f"<OrgMember org={self.org_id} user={self.user_id} role={self.role}>"


# ─── Datasets ─────────────────────────────────────────────────────────────────


class Dataset(Base):
    __tablename__ = "datasets"
    __table_args__ = (
        Index("ix_datasets_org_id", "org_id"),
        Index("ix_datasets_created_by", "created_by"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=_uuid
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)  # display name
    original_filename: Mapped[str] = mapped_column(
        Text, nullable=False
    )  # original upload name
    file_key: Mapped[str] = mapped_column(Text, nullable=False)  # R2/S3 object key
    file_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    file_format: Mapped[str] = mapped_column(
        Text, nullable=False
    )  # csv | tsv | xlsx | json | parquet | sqlite
    row_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    column_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(
        Text, nullable=False, default="pending"
    )  # pending | processing | ready | failed
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_starred: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    archived_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    org: Mapped["Organization"] = relationship(
        "Organization", back_populates="datasets"
    )
    created_by_user: Mapped["User"] = relationship("User", back_populates="datasets")
    analyses: Mapped[list["Analysis"]] = relationship(
        "Analysis", back_populates="dataset", cascade="all, delete-orphan"
    )
    monitors: Mapped[list["Monitor"]] = relationship(
        "Monitor", back_populates="dataset", cascade="all, delete-orphan"
    )
    comments: Mapped[list["DatasetComment"]] = relationship(
        "DatasetComment", back_populates="dataset", cascade="all, delete-orphan"
    )
    source_pipelines: Mapped[list["PipelineRecipe"]] = relationship(
        "PipelineRecipe", back_populates="source_dataset"
    )

    def __repr__(self) -> str:
        return f"<Dataset {self.name} status={self.status}>"


# ─── Analyses ─────────────────────────────────────────────────────────────────


class Analysis(Base):
    __tablename__ = "analyses"
    __table_args__ = (
        UniqueConstraint("dataset_id", "version", name="uq_analyses_dataset_version"),
        Index("ix_analyses_dataset_id", "dataset_id"),
        Index("ix_analyses_org_id", "org_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=_uuid
    )
    dataset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("datasets.id", ondelete="CASCADE"),
        nullable=False,
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    report: Mapped[dict] = mapped_column(JSONB, nullable=False)  # full EDAReport JSON
    ai_narrative: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )  # Claude-generated narrative
    job_id: Mapped[str | None] = mapped_column(Text, nullable=True)  # Celery job ID
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    dataset: Mapped["Dataset"] = relationship("Dataset", back_populates="analyses")

    def __repr__(self) -> str:
        return f"<Analysis dataset={self.dataset_id} v{self.version}>"


# ─── Monitors ─────────────────────────────────────────────────────────────────


class Monitor(Base):
    __tablename__ = "monitors"
    __table_args__ = (
        Index("ix_monitors_org_id", "org_id"),
        Index("ix_monitors_dataset_id", "dataset_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=_uuid
    )
    dataset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("datasets.id", ondelete="CASCADE"),
        nullable=False,
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    check_type: Mapped[str] = mapped_column(
        Text, nullable=False
    )  # row_count | null_rate | quality_score | column_drift
    column_name: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )  # null = dataset-level check
    condition: Mapped[str] = mapped_column(
        Text, nullable=False
    )  # lt | gt | eq | change_pct
    threshold: Mapped[float] = mapped_column(Float, nullable=False)
    schedule: Mapped[str] = mapped_column(
        Text, nullable=False, default="0 * * * *"
    )  # cron expression
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_checked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_status: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )  # ok | triggered | error
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    dataset: Mapped["Dataset"] = relationship("Dataset", back_populates="monitors")
    org: Mapped["Organization"] = relationship(
        "Organization", back_populates="monitors"
    )
    created_by_user: Mapped["User"] = relationship("User", back_populates="monitors")
    runs: Mapped[list["MonitorRun"]] = relationship(
        "MonitorRun", back_populates="monitor", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Monitor {self.name} check={self.check_type}>"


# ─── Monitor Runs ─────────────────────────────────────────────────────────────


class MonitorRun(Base):
    __tablename__ = "monitor_runs"
    __table_args__ = (Index("ix_monitor_runs_monitor_id", "monitor_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=_uuid
    )
    monitor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("monitors.id", ondelete="CASCADE"),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(Text, nullable=False)  # ok | triggered | error
    actual_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    ran_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    monitor: Mapped["Monitor"] = relationship("Monitor", back_populates="runs")

    def __repr__(self) -> str:
        return f"<MonitorRun monitor={self.monitor_id} status={self.status}>"


# ─── Data Connectors ──────────────────────────────────────────────────────────


class DataConnector(Base):
    """
    Saved connection config for external data sources.
    Credentials are stored Fernet-encrypted in config_encrypted.
    connector_type: postgres | s3
    """

    __tablename__ = "data_connectors"
    __table_args__ = (Index("ix_data_connectors_org_id", "org_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=_uuid
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    connector_type: Mapped[str] = mapped_column(Text, nullable=False)  # postgres | s3
    config_encrypted: Mapped[str] = mapped_column(
        Text, nullable=False
    )  # Fernet-encrypted JSON
    last_tested_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_test_ok: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    org: Mapped["Organization"] = relationship(
        "Organization", back_populates="connectors"
    )
    created_by_user: Mapped["User"] = relationship("User")

    def __repr__(self) -> str:
        return f"<DataConnector {self.name} type={self.connector_type}>"


# ─── Pipeline Recipes ─────────────────────────────────────────────────────────


class PipelineRecipe(Base):
    """
    ETL pipeline definition.
    graph stores Source → Transform nodes → Destination in a JSON structure.
    """

    __tablename__ = "pipeline_recipes"
    __table_args__ = (
        Index("ix_pipeline_recipes_org_id", "org_id"),
        Index("ix_pipeline_recipes_source_dataset_id", "source_dataset_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=_uuid
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    source_dataset_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("datasets.id", ondelete="SET NULL"),
        nullable=True,
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    graph: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    destination_type: Mapped[str] = mapped_column(
        Text, nullable=False, default="dataset"
    )
    destination_config: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    schedule: Mapped[str] = mapped_column(Text, nullable=False, default="0 * * * *")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    last_run_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_run_status: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )  # pending | running | success | failed
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    org: Mapped["Organization"] = relationship(
        "Organization", back_populates="pipelines"
    )
    created_by_user: Mapped["User"] = relationship("User", back_populates="pipelines")
    source_dataset: Mapped["Dataset | None"] = relationship(
        "Dataset", back_populates="source_pipelines"
    )
    versions: Mapped[list["PipelineRecipeVersion"]] = relationship(
        "PipelineRecipeVersion", back_populates="pipeline", cascade="all, delete-orphan"
    )
    runs: Mapped[list["PipelineRun"]] = relationship(
        "PipelineRun", back_populates="pipeline", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<PipelineRecipe {self.name} v{self.version}>"


# ─── Pipeline Recipe Versions ────────────────────────────────────────────────


class PipelineRecipeVersion(Base):
    __tablename__ = "pipeline_recipe_versions"
    __table_args__ = (
        UniqueConstraint(
            "pipeline_id",
            "version",
            name="uq_pipeline_recipe_versions_pipeline_version",
        ),
        Index("ix_pipeline_recipe_versions_pipeline_id", "pipeline_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=_uuid
    )
    pipeline_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("pipeline_recipes.id", ondelete="CASCADE"),
        nullable=False,
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    graph: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    pipeline: Mapped["PipelineRecipe"] = relationship(
        "PipelineRecipe", back_populates="versions"
    )

    def __repr__(self) -> str:
        return f"<PipelineRecipeVersion pipeline={self.pipeline_id} v{self.version}>"


# ─── Pipeline Runs ───────────────────────────────────────────────────────────


class PipelineRun(Base):
    __tablename__ = "pipeline_runs"
    __table_args__ = (
        Index("ix_pipeline_runs_org_id", "org_id"),
        Index("ix_pipeline_runs_pipeline_id", "pipeline_id"),
        Index("ix_pipeline_runs_started_at", "started_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=_uuid
    )
    pipeline_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("pipeline_recipes.id", ondelete="CASCADE"),
        nullable=False,
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    triggered_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    recipe_version: Mapped[int] = mapped_column(Integer, nullable=False)
    trigger_type: Mapped[str] = mapped_column(
        Text, nullable=False, default="manual"
    )  # manual | schedule
    status: Mapped[str] = mapped_column(
        Text, nullable=False, default="pending"
    )  # pending | running | success | failed
    logs: Mapped[str | None] = mapped_column(Text, nullable=True)
    metrics: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    output_dataset_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("datasets.id", ondelete="SET NULL"),
        nullable=True,
    )
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    finished_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    pipeline: Mapped["PipelineRecipe"] = relationship(
        "PipelineRecipe", back_populates="runs"
    )
    org: Mapped["Organization"] = relationship(
        "Organization", back_populates="pipeline_runs"
    )

    def __repr__(self) -> str:
        return f"<PipelineRun pipeline={self.pipeline_id} status={self.status}>"


# ─── Dataset Comments ─────────────────────────────────────────────────────────


class DatasetComment(Base):
    """Threaded annotation comments attached to a dataset or a specific column."""

    __tablename__ = "dataset_comments"
    __table_args__ = (
        Index("ix_dataset_comments_dataset_id", "dataset_id"),
        Index("ix_dataset_comments_org_id", "org_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=_uuid
    )
    dataset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("datasets.id", ondelete="CASCADE"),
        nullable=False,
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("dataset_comments.id", ondelete="CASCADE"),
        nullable=True,
    )
    column_name: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )  # null → dataset-level comment
    author_name: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )  # cached display name
    content: Mapped[str] = mapped_column(Text, nullable=False)
    edited_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    dataset: Mapped["Dataset"] = relationship("Dataset", back_populates="comments")
    org: Mapped["Organization"] = relationship(
        "Organization", back_populates="comments"
    )
    replies: Mapped[list["DatasetComment"]] = relationship(
        "DatasetComment",
        foreign_keys=[parent_id],
        # remote_side marks the parent end of this self-referential FK so the
        # backref maps as many-to-one (without it, mapper configuration fails).
        backref=backref("parent", remote_side=[id]),
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<DatasetComment dataset={self.dataset_id} col={self.column_name}>"


# ─── Audit Logs ───────────────────────────────────────────────────────────────


class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_logs_org_id", "org_id"),
        Index("ix_audit_logs_created_at", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=_uuid
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    action: Mapped[str] = mapped_column(
        Text, nullable=False
    )  # upload | analyze | export | delete | invite | query
    resource_type: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )  # dataset | analysis | monitor
    resource_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    extra: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )  # stored as text for compatibility
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    org: Mapped["Organization"] = relationship(
        "Organization", back_populates="audit_logs"
    )

    def __repr__(self) -> str:
        return f"<AuditLog action={self.action} org={self.org_id}>"
