// import * as pulumi from '@pulumi/pulumi';
// import * as aws from '@pulumi/aws';
import * as awsx from '@pulumi/awsx';

const sg = new awsx.ec2.SecurityGroup('satisfactory-security-group');
awsx.ec2.SecurityGroupRule.ingress(
  'satisfactory-7777',
  sg,
  new awsx.ec2.AnyIPv4Location(),
  new awsx.ec2.UdpPorts(7777),
  'allow satisfactory 7777'
);
awsx.ec2.SecurityGroupRule.ingress(
  'satisfactory-15000',
  sg,
  new awsx.ec2.AnyIPv4Location(),
  new awsx.ec2.UdpPorts(15000),
  'allow satisfactory 15000'
);
awsx.ec2.SecurityGroupRule.ingress(
  'satisfactory-15777',
  sg,
  new awsx.ec2.AnyIPv4Location(),
  new awsx.ec2.UdpPorts(15777),
  'allow satisfactory 15777'
);
awsx.ec2.SecurityGroupRule.egress(
  'all',
  sg,
  new awsx.ec2.AnyIPv4Location(),
  new awsx.ec2.AllTraffic(),
  'allow all'
);

const cluster = new awsx.ecs.Cluster('satisfactory-cluster', { securityGroups: [sg] });

// still failing healthchecks; are these the problem???
const nlb = new awsx.lb.NetworkLoadBalancer('satisfactory-nlb', { external: true });

const target7777 = nlb.createTargetGroup('satisfactory-7777', {
  port: 7777,
  protocol: 'UDP',
});
const listener7777 = target7777.createListener('satisfactory-7777', {
  port: 7777,
  protocol: 'UDP',
});

const target15000 = nlb.createTargetGroup('satisfactory-15000', {
  port: 15000,
  protocol: 'UDP',
});
const listener15000 = target15000.createListener('satisfactory-15000', {
  port: 15000,
  protocol: 'UDP',
});

const target15777 = nlb.createTargetGroup('satisfactory-15777', {
  port: 15777,
  protocol: 'UDP',
});
const listener15777 = target15777.createListener('satisfactory-15777', {
  port: 15777,
  protocol: 'UDP',
});

new awsx.ecs.FargateService('satisfactory', {
  cluster,
  desiredCount: 1,
  // loadBalancers: [nlb],
  loadBalancers: [
    {
      targetGroupArn: target7777.targetGroup.arn,
      containerName: 'satisfactory',
      containerPort: 7777,
    },
    {
      targetGroupArn: target15000.targetGroup.arn,
      containerName: 'satisfactory',
      containerPort: 15000,
    },
    {
      targetGroupArn: target15777.targetGroup.arn,
      containerName: 'satisfactory',
      containerPort: 15777,
    },
  ],
  taskDefinitionArgs: {
    containers: {
      satisfactory: {
        image: 'wolveix/satisfactory-server:latest',
        memory: 8192,
        // healthCheck: {
        //   startPeriod: 300,
        //   command: ['CMD-SHELL', 'echo hi || exit 1'],
        // },
        environment: [
          { name: 'STEAMUSER', value: 'anonymous' },
          { name: 'STEAMBETA', value: 'false' },
          { name: 'MAXBACKUPS', value: '10' },
        ],
        portMappings: [listener7777, listener15000, listener15777],
      },
    },
  },
});

// eslint-disable-next-line import/prefer-default-export
export const url = listener7777.endpoint.hostname;
