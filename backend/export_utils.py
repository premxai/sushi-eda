"""Export utilities for generating PDF reports and Excel files."""

import pandas as pd
from typing import Dict, Any
import io


class DataExporter:
    """Handles data export to various formats."""

    def __init__(self, df: pd.DataFrame, report: Dict[str, Any]):
        self.df = df
        self.report = report

    def to_excel(self) -> bytes:
        """Export DataFrame and analysis to Excel with multiple sheets."""
        output = io.BytesIO()
        
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            # Write main data
            self.df.to_excel(writer, sheet_name='Data', index=False)
            
            # Write summary statistics
            if 'column_analysis' in self.report:
                summary_data = []
                for col in self.report['column_analysis']:
                    row = {
                        'Column': col['name'],
                        'Type': col['dtype'],
                        'Missing': col['missing_count'],
                        'Missing %': col['missing_percent'],
                        'Unique': col['unique_count'],
                    }
                    if 'stats' in col and col['stats']:
                        row.update({
                            'Mean': col['stats'].get('mean'),
                            'Median': col['stats'].get('median'),
                            'Std': col['stats'].get('std'),
                            'Min': col['stats'].get('min'),
                            'Max': col['stats'].get('max'),
                        })
                    summary_data.append(row)
                
                summary_df = pd.DataFrame(summary_data)
                summary_df.to_excel(writer, sheet_name='Summary', index=False)
            
            # Write correlation matrix
            if 'correlation_matrix' in self.report:
                corr = self.report['correlation_matrix']
                if corr['columns']:
                    corr_df = pd.DataFrame(
                        corr['matrix'],
                        columns=corr['columns'],
                        index=corr['columns']
                    )
                    corr_df.to_excel(writer, sheet_name='Correlations')
            
            # Write outliers
            if 'outliers' in self.report:
                outliers_df = pd.DataFrame(self.report['outliers'])
                if not outliers_df.empty:
                    outliers_df.to_excel(writer, sheet_name='Outliers', index=False)
        
        output.seek(0)
        return output.getvalue()

    def to_csv(self) -> bytes:
        """Export DataFrame to CSV."""
        output = io.StringIO()
        self.df.to_csv(output, index=False)
        return output.getvalue().encode('utf-8')

    def generate_markdown_report(self) -> str:
        """Generate a markdown report of the analysis."""
        lines = []
        lines.append("# Data Analysis Report\n")
        
        # Basic info
        if 'basic_info' in self.report:
            info = self.report['basic_info']
            lines.append("## Dataset Overview\n")
            lines.append(f"- **Rows**: {info['rows']:,}")
            lines.append(f"- **Columns**: {info['columns']}")
            lines.append(f"- **Memory Usage**: {info['memory_usage_mb']} MB")
            lines.append(f"- **Duplicate Rows**: {info['duplicate_rows']:,}")
            lines.append(f"- **Total Missing Values**: {info['total_missing']:,}\n")
        
        # Quality score
        if 'quality_score' in self.report:
            quality = self.report['quality_score']
            lines.append("## Data Quality\n")
            lines.append(f"**Overall Score**: {quality['overall_score']}/100\n")
            lines.append("### Component Scores")
            for component, score in quality['component_scores'].items():
                lines.append(f"- {component.replace('_', ' ').title()}: {score}/100")
            lines.append("")
        
        # Column analysis
        if 'column_analysis' in self.report:
            lines.append("## Column Analysis\n")
            for col in self.report['column_analysis'][:10]:  # First 10 columns
                lines.append(f"### {col['name']}")
                lines.append(f"- Type: {col['dtype']}")
                lines.append(f"- Missing: {col['missing_count']} ({col['missing_percent']}%)")
                lines.append(f"- Unique Values: {col['unique_count']}")
                
                if 'stats' in col and col['stats']:
                    stats = col['stats']
                    lines.append(f"- Mean: {stats['mean']:.4f}")
                    lines.append(f"- Median: {stats['median']:.4f}")
                    lines.append(f"- Std Dev: {stats['std']:.4f}")
                    lines.append(f"- Range: [{stats['min']:.4f}, {stats['max']:.4f}]")
                lines.append("")
        
        # Outliers
        if 'outliers' in self.report:
            outliers = [o for o in self.report['outliers'] if o['outlier_count'] > 0]
            if outliers:
                lines.append("## Outlier Detection\n")
                for outlier in outliers[:5]:  # Top 5
                    lines.append(f"### {outlier['column']}")
                    lines.append(f"- Outliers: {outlier['outlier_count']} ({outlier['outlier_percent']}%)")
                    lines.append(f"- IQR: {outlier['iqr']:.4f}")
                    lines.append(f"- Bounds: [{outlier['lower_bound']:.4f}, {outlier['upper_bound']:.4f}]")
                    lines.append("")
        
        return "\n".join(lines)
