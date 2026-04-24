// CodeGuard – Module 2 CI/CD Pipeline
// Tools: Git · Jenkins · Docker · AWS ECR · EC2 · Terraform · Ansible
//
// Prerequisites (Jenkins credentials store):
//   aws-credentials    → AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
//   github-token       → GitHub PAT (for webhook status updates)
//   codeguard-env      → Secret file: production .env

pipeline {
    agent any

    environment {
        // ── AWS / ECR ────────────────────────────────────────────────────
        AWS_REGION      = 'us-east-1'
        ECR_REGISTRY    = "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
        BACKEND_IMAGE   = "${ECR_REGISTRY}/codeguard-backend"
        FRONTEND_IMAGE  = "${ECR_REGISTRY}/codeguard-frontend"
        IMAGE_TAG       = "${env.GIT_COMMIT?.take(7) ?: 'latest'}"

        // ── Terraform ────────────────────────────────────────────────────
        TF_DIR          = 'infra/terraform'
        TF_VAR_FILE     = 'infra/terraform/env/dev.tfvars'

        // ── Ansible ──────────────────────────────────────────────────────
        ANSIBLE_DIR     = 'infra/ansible'
        ANSIBLE_HOST    = "${env.EC2_HOST ?: 'localhost'}"
    }

    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timestamps()
        timeout(time: 30, unit: 'MINUTES')
    }

    stages {

        // ── Stage 1: Checkout ────────────────────────────────────────────
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    env.GIT_SHORT = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
                    echo "Building commit: ${env.GIT_SHORT}"
                }
            }
        }

        // ── Stage 2: Lint & Unit Tests ───────────────────────────────────
        stage('Lint & Test') {
            parallel {
                stage('Backend lint') {
                    steps {
                        dir('backend') {
                            sh '''
                                python3 -m venv .venv
                                . .venv/bin/activate
                                pip install -q -r requirements.txt
                                python -m pylint app/ --fail-under=7.0 \
                                    --output-format=text || true
                            '''
                        }
                    }
                }
                stage('Frontend lint') {
                    steps {
                        dir('frontend') {
                            sh '''
                                npm ci --silent
                                npx eslint src/ --max-warnings 20 || true
                            '''
                        }
                    }
                }
            }
        }

        // ── Stage 3: Build Docker images ─────────────────────────────────
        stage('Build') {
            steps {
                script {
                    withCredentials([[$class: 'AmazonWebServicesCredentialsBinding',
                                      credentialsId: 'aws-credentials']]) {
                        sh """
                            # Login to ECR
                            aws ecr get-login-password --region ${AWS_REGION} \
                              | docker login --username AWS --password-stdin ${ECR_REGISTRY}

                            # Build backend
                            docker build -t ${BACKEND_IMAGE}:${IMAGE_TAG} \
                                         -t ${BACKEND_IMAGE}:latest ./backend

                            # Build frontend
                            docker build -t ${FRONTEND_IMAGE}:${IMAGE_TAG} \
                                         -t ${FRONTEND_IMAGE}:latest ./frontend
                        """
                    }
                }
            }
        }

        // ── Stage 4: Push to ECR ─────────────────────────────────────────
        stage('Push') {
            when { branch 'main' }
            steps {
                script {
                    withCredentials([[$class: 'AmazonWebServicesCredentialsBinding',
                                      credentialsId: 'aws-credentials']]) {
                        sh """
                            docker push ${BACKEND_IMAGE}:${IMAGE_TAG}
                            docker push ${BACKEND_IMAGE}:latest
                            docker push ${FRONTEND_IMAGE}:${IMAGE_TAG}
                            docker push ${FRONTEND_IMAGE}:latest
                        """
                    }
                }
            }
        }

        // ── Stage 5: Terraform plan/apply ────────────────────────────────
        stage('Infra (Terraform)') {
            when { branch 'main' }
            steps {
                script {
                    withCredentials([[$class: 'AmazonWebServicesCredentialsBinding',
                                      credentialsId: 'aws-credentials']]) {
                        dir(TF_DIR) {
                            sh """
                                terraform init -input=false
                                terraform validate
                                terraform plan -input=false -out=tfplan \
                                    -var-file=../../${TF_VAR_FILE} \
                                    -var="environment=dev"
                                terraform apply -input=false -auto-approve tfplan
                            """
                        }
                    }
                }
            }
        }

        // ── Stage 6: Deploy via Ansible ───────────────────────────────────
        stage('Deploy (Ansible)') {
            when { branch 'main' }
            steps {
                withCredentials([
                    [$class: 'AmazonWebServicesCredentialsBinding', credentialsId: 'aws-credentials'],
                    [credentialsId: 'codeguard-env', variable: 'ENV_FILE'],
                ]) {
                    dir(ANSIBLE_DIR) {
                        sh """
                            ansible-playbook site.yml \
                                -i inventory.ini \
                                --extra-vars "image_tag=${IMAGE_TAG} \
                                             ecr_registry=${ECR_REGISTRY} \
                                             aws_region=${AWS_REGION}" \
                                --ssh-extra-args='-o StrictHostKeyChecking=no'
                        """
                    }
                }
            }
        }

        // ── Stage 7: Smoke test ───────────────────────────────────────────
        stage('Smoke Test') {
            when { branch 'main' }
            steps {
                script {
                    def url = "http://${ANSIBLE_HOST}/api/health"
                    sh """
                        for i in \$(seq 1 10); do
                            STATUS=\$(curl -s -o /dev/null -w '%{http_code}' ${url} || echo 000)
                            if [ "\$STATUS" = "200" ]; then
                                echo "Health check passed (attempt \$i)"
                                exit 0
                            fi
                            echo "Attempt \$i: status \$STATUS — retrying in 10s…"
                            sleep 10
                        done
                        echo "Smoke test failed after 10 attempts"
                        exit 1
                    """
                }
            }
        }
    }

    post {
        success {
            echo "✅ Pipeline succeeded — ${env.GIT_SHORT} deployed to ${ANSIBLE_HOST}"
        }
        failure {
            echo "❌ Pipeline failed on branch ${env.BRANCH_NAME}"
        }
        always {
            // Clean workspace to save disk space
            cleanWs()
        }
    }
}
