import { Injectable, Logger } from '@nestjs/common';
import * as k8s from '@kubernetes/client-node';

@Injectable()
export class ExecutionService {
  private readonly logger = new Logger(ExecutionService.name);
  private k8sApi: k8s.AppsV1Api;

  constructor() {
    this.k8sApi = this.getPatchedConfig().makeApiClient(k8s.AppsV1Api);
    this.logger.log('Kubernetes client initialized.');
  }

  private getPatchedConfig(): k8s.KubeConfig {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    
    const cluster = kc.getCurrentCluster() as any;
    if (cluster && (cluster.server.includes('0.0.0.0') || cluster.server.includes('127.0.0.1'))) {
      cluster.server = cluster.server
        .replace('0.0.0.0', 'host.docker.internal')
        .replace('127.0.0.1', 'host.docker.internal');
      cluster.skipTLSVerify = true;
    }
    return kc;
  }

  async scaleDeployment(namespace: string, deploymentName: string, replicas: number): Promise<any> {
    const patch = [{ op: 'replace', path: '/spec/replicas', value: replicas }];
    return this.patchResource(namespace, 'deployment', deploymentName, patch);
  }

  async patchResource(namespace: string, resourceType: string, name: string, patch: any[]): Promise<any> {
    try {
      this.logger.log(`Patching ${resourceType} ${name} in namespace ${namespace}`);
      
      const kc = this.getPatchedConfig();
      const objApi = kc.makeApiClient(k8s.KubernetesObjectApi);
      
      const spec = {
        apiVersion: this.getApiVersion(resourceType),
        kind: this.getKind(resourceType),
        metadata: {
          name: name,
          namespace: namespace,
        },
      };

      const response = await objApi.patch(
        spec,
        undefined,
        undefined,
        undefined,
        undefined,
        patch as any,
        { headers: { 'Content-type': 'application/json-patch+json' } } as any
      );

      return (response as any).body;
    } catch (error) {
      this.logger.error(`Error patching resource: ${error.body?.message || error.message}`);
      throw error;
    }
  }

  private getApiVersion(type: string): string {
    const mapping = {
      deployment: 'apps/v1',
      pod: 'v1',
      service: 'v1',
      namespace: 'v1',
    };
    return mapping[type.toLowerCase()] || 'v1';
  }

  private getKind(type: string): string {
    const mapping = {
      deployment: 'Deployment',
      pod: 'Pod',
      service: 'Service',
      namespace: 'Namespace',
    };
    return mapping[type.toLowerCase()] || type;
  }
}
