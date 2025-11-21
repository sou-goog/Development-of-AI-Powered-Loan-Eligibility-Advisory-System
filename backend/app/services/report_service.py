"""
PDF Report Generation Service
"""

from jinja2 import Environment, FileSystemLoader
from pathlib import Path
from datetime import datetime
import base64
from app.utils.logger import get_logger

logger = get_logger(__name__)


class ReportService:
    """Service for generating PDF reports using Jinja2 and WeasyPrint"""
    
    def __init__(self):
        # Setup Jinja2 environment
        template_dir = Path(__file__).parent.parent / "templates"
        template_dir.mkdir(exist_ok=True)
        self.env = Environment(loader=FileSystemLoader(template_dir))
        
        # Reports directory
        self.reports_dir = Path(__file__).parent.parent / "static" / "reports"
        self.reports_dir.mkdir(exist_ok=True, parents=True)
    
    def generate_report(self, application_data: dict, output_filename: str = None) -> str:
        """
        Generate PDF report for loan application
        
        Args:
            application_data: Dictionary with application details
            output_filename: Optional custom filename for the report
        
        Returns:
            Path to generated PDF file
        """
        # Prepare report data and HTML content first
        report_data = self._prepare_report_data(application_data)
        html_content = self._render_template(report_data)

        # Prefer PDF via WeasyPrint when available; otherwise fallback to HTML file
        try:
            from weasyprint import HTML  # type: ignore
            # Filename
            if not output_filename:
                app_id = application_data.get('id', 'unknown')
                output_filename = f"loan_report_{app_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
            output_path = self.reports_dir / output_filename
            HTML(string=html_content).write_pdf(str(output_path))
            logger.info(f"Generated PDF report: {output_path}")
            return str(output_path)
        except Exception as e:
            # Fallback: write HTML report instead of failing
            try:
                if not output_filename:
                    app_id = application_data.get('id', 'unknown')
                    output_filename = f"loan_report_{app_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html"
                else:
                    # Ensure .html extension for fallback
                    if not output_filename.lower().endswith('.html'):
                        output_filename = output_filename.rsplit('.', 1)[0] + '.html'
                output_path = self.reports_dir / output_filename
                output_path.write_text(html_content, encoding='utf-8')
                logger.warning(f"WeasyPrint unavailable or failed ({e}). Wrote HTML report instead: {output_path}")
                return str(output_path)
            except Exception as e2:
                logger.error(f"Report generation failed (fallback also failed): {e2}")
                raise
    
    def _prepare_report_data(self, application_data: dict) -> dict:
        """Prepare data for report template"""
        # Extract extended metrics with safe fallbacks
        monthly_income = application_data.get("monthly_income") or (
            (application_data.get("annual_income") or 0) / 12.0 if application_data.get("annual_income") else None
        )
        avg_balance = application_data.get("avg_balance")
        existing_emi = application_data.get("existing_emi")
        dti = application_data.get("debt_to_income_ratio")
        loan_amount_requested = application_data.get("loan_amount_requested") or application_data.get("loan_amount")

        return {
            "application_id": application_data.get("id"),
            "full_name": application_data.get("full_name", "N/A"),
            "email": application_data.get("email", "N/A"),
            "phone": application_data.get("phone", "N/A"),
            "annual_income": f"${application_data.get('annual_income', 0):,.2f}",
            "monthly_income": f"${(monthly_income or 0):,.2f}",
            "credit_score": application_data.get("credit_score", "N/A"),
            "loan_amount": f"${(loan_amount_requested or 0):,.2f}",
            "loan_term": f"{application_data.get('loan_term_months', 0)} months",
            "dependents": application_data.get("num_dependents", 0),
            "employment_status": application_data.get("employment_status", "N/A"),
            "eligibility_score": f"{application_data.get('eligibility_score', 0):.1%}",
            "eligibility_status": application_data.get("eligibility_status", "Pending").title(),
            "approval_status": application_data.get("approval_status", "Pending").title(),
            "manager_notes": application_data.get("manager_notes", "No notes"),
            "document_verified": "Yes" if application_data.get("document_verified") else "No",
            # Extended metrics
            "avg_balance": f"${(avg_balance or 0):,.2f}",
            "existing_emi": f"${(existing_emi or 0):,.2f}",
            "dti": f"{(dti or 0):.1%}",
            "generated_date": datetime.now().strftime("%B %d, %Y at %I:%M %p"),
            "generated_timestamp": datetime.now().isoformat(),
        }
    
    def _render_template(self, report_data: dict) -> str:
        """Render HTML template with data"""
        try:
            # Load template
            template = self.env.get_template("report_template.html")
            return template.render(**report_data)
        except Exception as e:
            logger.error(f"Error rendering template: {str(e)}")
            # Return fallback HTML if template doesn't exist
            return self._get_fallback_template(report_data)
    
    def _get_fallback_template(self, report_data: dict) -> str:
        """Fallback HTML template if template file doesn't exist"""
        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Loan Application Report</title>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 40px; }}
                .header {{ border-bottom: 2px solid #333; padding-bottom: 20px; }}
                .section {{ margin: 20px 0; }}
                .section-title {{ font-weight: bold; font-size: 16px; margin-top: 15px; }}
                .field {{ display: flex; justify-content: space-between; padding: 8px 0; }}
                .footer {{ margin-top: 40px; border-top: 1px solid #ccc; padding-top: 20px; font-size: 12px; }}
                .status {{ padding: 10px; border-radius: 5px; text-align: center; font-weight: bold; }}
                .eligible {{ background-color: #d4edda; color: #155724; }}
                .ineligible {{ background-color: #f8d7da; color: #721c24; }}
            </style>
        </head>
        <body>
            <div class="header">
                <h1>AI Loan System - Application Report</h1>
                <p>Report ID: {report_data['application_id']}</p>
            </div>
            
            <div class="section">
                <div class="section-title">Applicant Information</div>
                <div class="field"><span>Full Name:</span><span>{report_data['full_name']}</span></div>
                <div class="field"><span>Email:</span><span>{report_data['email']}</span></div>
                <div class="field"><span>Phone:</span><span>{report_data['phone']}</span></div>
            </div>
            
            <div class="section">
                <div class="section-title">Financial Information</div>
                <div class="field"><span>Annual Income:</span><span>{report_data['annual_income']}</span></div>
                <div class="field"><span>Monthly Income:</span><span>{report_data['monthly_income']}</span></div>
                <div class="field"><span>Credit Score:</span><span>{report_data['credit_score']}</span></div>
                <div class="field"><span>Loan Amount:</span><span>{report_data['loan_amount']}</span></div>
                <div class="field"><span>Loan Term:</span><span>{report_data['loan_term']}</span></div>
                <div class="field"><span>Average Balance:</span><span>{report_data['avg_balance']}</span></div>
                <div class="field"><span>Existing EMI:</span><span>{report_data['existing_emi']}</span></div>
            </div>
            
            <div class="section">
                <div class="section-title">Application Status</div>
                <div class="field"><span>Eligibility Score:</span><span>{report_data['eligibility_score']}</span></div>
                <div class="status {report_data['eligibility_status'].lower()}">
                    {report_data['eligibility_status']}
                </div>
                <div class="field"><span>Approval Status:</span><span>{report_data['approval_status']}</span></div>
                <div class="field"><span>Document Verified:</span><span>{report_data['document_verified']}</span></div>
                <div class="field"><span>Debt-to-Income Ratio:</span><span>{report_data['dti']}</span></div>
            </div>
            
            <div class="section">
                <div class="section-title">Manager Notes</div>
                <p>{report_data['manager_notes']}</p>
            </div>
            
            <div class="footer">
                <p>Generated on: {report_data['generated_date']}</p>
                <p>This is an automated report from the AI Loan System.</p>
            </div>
        </body>
        </html>
        """
