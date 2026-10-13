@echo off
rem Runs a Python script with Kidzink AI's standard libraries, through the app's bundled uvx.
rem   kz-python script.py [args...]
rem   kz-python -c "python code"
rem Keep the library list in sync with kz-python (macOS).
if "%~1"=="" (
  echo usage: kz-python ^<script.py^> [args...]  or  kz-python -c "code" 1>&2
  exit /b 2
)
uvx --quiet --directory "%CD%" --with openpyxl --with python-docx --with python-pptx --with pypdf --with pdfplumber --with pandas python %*
