#!/usr/bin/env groovy
/**
 * Declarative pipeline for the orders-service.
 * Builds, tests and deploys to staging on every merge to main.
 */
import groovy.transform.Field

@Field final String SERVICE = 'orders-service'
@Field final int MAX_RETRIES = 3
@Field final Map<String, String> REGISTRIES = [
    staging   : 'registry.staging.godhuli.io',
    production: 'registry.godhuli.io',
]

def versionFrom(String tag) {
    def m = tag =~ /^v(\d+)\.(\d+)\.(\d+)(?:-rc\.(\d+))?$/
    if (!m.matches()) {
        error "Tag '${tag}' is not a semantic version"
    }
    return [major: m[0][1] as int, minor: m[0][2] as int, patch: m[0][3] as int]
}

pipeline {
    agent { label 'linux && docker' }

    environment {
        IMAGE   = "${REGISTRIES.staging}/${SERVICE}"
        JAVA_OPTS = '-Xmx1g -XX:+UseG1GC'
    }

    options {
        timeout(time: 30, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '20'))
    }

    stages {
        stage('Test') {
            steps {
                sh './gradlew test --no-daemon'
                junit testResults: '**/build/test-results/**/*.xml', allowEmptyResults: false
            }
        }

        stage('Build image') {
            steps {
                script {
                    def shortSha = env.GIT_COMMIT?.take(8) ?: 'local'
                    def tags = ['latest', shortSha].collect { "${IMAGE}:${it}" }
                    retry(MAX_RETRIES) {
                        sh "docker build ${tags.collect { "-t $it" }.join(' ')} ."
                    }
                    echo "Built ${tags.size()} tags for ${SERVICE}\n\t${tags.join('\n\t')}"
                }
            }
        }

        stage('Deploy staging') {
            when { branch 'main' }
            steps {
                // TODO: switch to Argo Rollouts once the cluster is upgraded
                sh """
                    kubectl -n orders set image deploy/${SERVICE} app=${IMAGE}:latest
                    kubectl -n orders rollout status deploy/${SERVICE} --timeout=120s
                """
            }
        }
    }

    post {
        failure { slackSend channel: '#orders', message: "${env.JOB_NAME} #${env.BUILD_NUMBER}" }
        always  { cleanWs(deleteDirs: true, notFailBuild: true) }
    }
}
